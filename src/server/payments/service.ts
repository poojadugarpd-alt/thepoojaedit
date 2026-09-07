import "server-only";

import type {
  Order,
  PaymentAttempt,
  Prisma,
  PrismaClient,
  Refund,
} from "@/generated/prisma";
import { openOperationalTask } from "@/server/events/operational-tasks";
import { runOnce } from "@/server/events/side-effects";
import { settleCapturedPayment } from "@/server/orders/lifecycle";
import {
  canTransition,
  deriveAggregatePaymentStatus,
  ORDER_TRANSITIONS,
  type OrderStatus,
} from "@/server/orders/state";
import { appendOrderTimeline } from "@/server/orders/timeline";
import {
  ingestWebhook,
  markWebhookFailed,
  markWebhookProcessed,
  WebhookVerificationError,
  type ReconcilePort,
} from "@/server/webhooks/inbox";

import {
  PaymentError,
  PaymentMismatchError,
  PaymentVerificationError,
  RefundLimitError,
  type NormalizedPayment,
  type PaymentProvider,
  type VerifiedProviderWebhook,
} from "./port";

/**
 * Provider-neutral payment orchestration (master §7, §8). Razorpay-specific
 * details live in the adapter; this module only ever sees the normalised port
 * types. Every function takes an explicit `PaymentProvider` so tests inject the
 * in-memory double.
 */

type CheckoutOutcome =
  | "confirmed"
  | "authorized_pending"
  | "failed"
  | "review";

export interface VerifyCheckoutResult {
  order: Order;
  outcome: CheckoutOutcome;
}

const SETTLEABLE_ATTEMPT = ["CREATED", "PENDING", "AUTHORIZED"] as const;

function verificationBlob(
  payment: NormalizedPayment,
  source: string,
): Prisma.InputJsonValue {
  return {
    checkedAt: new Date().toISOString(),
    source,
    providerStatus: payment.status,
    providerPaymentId: payment.providerPaymentId,
    amountPaise: payment.amountPaise,
    currency: payment.currency,
    method: payment.method,
  };
}

// ─────────────────────────── provider order creation ─────────────────────────

/**
 * Create (or reuse) the provider order for a prepaid checkout. Called AFTER the
 * order transaction has committed (master §7.4). The local `PaymentAttempt` row
 * — keyed by a unique `operationKey` — is claimed first, so a crash between the
 * provider call and the local write is recovered by reusing the same row on
 * retry. A duplicate provider order (orphaned, unpaid) is harmless; a duplicate
 * local attempt is not, and cannot happen.
 */
export async function createPaymentAttempt(
  db: PrismaClient,
  provider: PaymentProvider,
  input: { orderId: string },
): Promise<PaymentAttempt> {
  const order = await db.order.findUniqueOrThrow({ where: { id: input.orderId } });
  if (order.paymentMethod !== "PREPAID_RAZORPAY") {
    throw new PaymentError("This order is not a prepaid order; no payment attempt.");
  }
  if (order.orderStatus !== "PENDING_PAYMENT") {
    const last = await db.paymentAttempt.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
    });
    if (last) return last;
    throw new PaymentError(
      `Order ${order.orderNumber} is ${order.orderStatus}, not awaiting payment.`,
    );
  }

  // Reuse a still-usable attempt rather than spawning a second provider order.
  const live = await db.paymentAttempt.findFirst({
    where: {
      orderId: order.id,
      provider: provider.name,
      status: { in: [...SETTLEABLE_ATTEMPT] },
      providerOrderId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });
  if (live) return live;

  // Recover a claimed-but-incomplete attempt (crash between claiming the row and
  // the provider call) instead of creating a second one.
  let attempt = await db.paymentAttempt.findFirst({
    where: {
      orderId: order.id,
      provider: provider.name,
      status: "CREATED",
      providerOrderId: null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!attempt) {
    const seq =
      (await db.paymentAttempt.count({ where: { orderId: order.id } })) + 1;
    attempt = await db.paymentAttempt.create({
      data: {
        orderId: order.id,
        provider: provider.name,
        amountPaise: order.totalPaise,
        currency: order.currency,
        status: "CREATED",
        operationKey: `pay:${order.id}:${seq}`,
      },
    });
  }

  const created = await provider.createOrder({
    amountPaise: order.totalPaise,
    currency: "INR",
    receipt: order.orderNumber,
    operationKey: attempt.operationKey,
    notes: { orderId: order.id, orderNumber: order.orderNumber },
  });

  const withOrder = await db.paymentAttempt.update({
    where: { id: attempt.id },
    data: { providerOrderId: created.providerOrderId },
  });
  await db.$transaction((tx) =>
    appendOrderTimeline(tx, {
      orderId: order.id,
      type: "payment.attempt_created",
      payload: { attemptId: attempt.id, providerOrderId: created.providerOrderId },
    }),
  );
  return withOrder;
}

// ──────────────────────────── review / flag helper ──────────────────────────

async function flagForReview(
  db: PrismaClient,
  order: Order,
  attempt: PaymentAttempt,
  reason: string,
  extra?: { providerPaymentId?: string },
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        providerPaymentId: extra?.providerPaymentId ?? attempt.providerPaymentId,
        verification: {
          flaggedAt: new Date().toISOString(),
          reason,
        } satisfies Prisma.InputJsonValue,
      },
    });
    if (
      order.orderStatus !== "NEEDS_REVIEW" &&
      canTransition(
        ORDER_TRANSITIONS,
        order.orderStatus as OrderStatus,
        "NEEDS_REVIEW",
      )
    ) {
      await tx.order.update({
        where: { id: order.id, version: order.version },
        data: { orderStatus: "NEEDS_REVIEW", version: { increment: 1 } },
      });
    }
    await appendOrderTimeline(tx, {
      orderId: order.id,
      type: "payment.review_required",
      payload: { reason, attemptId: attempt.id },
    });
  });
  await openOperationalTask(db, {
    dedupeKey: `payment-review:${order.id}`,
    type: "PAYMENT_REVIEW",
    entityType: "Order",
    entityId: order.id,
    priority: 1,
    reason,
  });
}

/**
 * Persist a second successful payment on an order that is already settled and
 * raise a refund-review task. The extra `PaymentAttempt` row is idempotent on
 * `(provider, providerPaymentId)`, so a redelivered excess webhook is a no-op.
 */
async function recordExcessCapture(
  db: PrismaClient,
  input: {
    order: Order;
    providerName: string;
    providerOrderId: string | null;
    providerPaymentId: string;
    amountPaise: number;
    alsoPaymentId: string;
  },
): Promise<void> {
  try {
    await db.paymentAttempt.create({
      data: {
        orderId: input.order.id,
        provider: input.providerName,
        providerOrderId: input.providerOrderId,
        providerPaymentId: input.providerPaymentId,
        amountPaise: input.amountPaise,
        status: "CAPTURED",
        operationKey: `pay:${input.order.id}:excess:${input.providerPaymentId}`,
        verification: {
          recordedAt: new Date().toISOString(),
          reason: "excess capture",
        } satisfies Prisma.InputJsonValue,
      },
    });
    await db.$transaction((tx) =>
      appendOrderTimeline(tx, {
        orderId: input.order.id,
        type: "payment.excess_capture",
        payload: {
          providerPaymentId: input.providerPaymentId,
          alsoCaptured: input.alsoPaymentId,
        },
      }),
    );
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2002") throw e; // already recorded
  }
  await openOperationalTask(db, {
    dedupeKey: `payment-review:${input.order.id}`,
    type: "PAYMENT_REVIEW",
    entityType: "Order",
    entityId: input.order.id,
    priority: 1,
    reason: `excess capture: ${input.providerPaymentId} in addition to ${input.alsoPaymentId}`,
  });
}

// ───────────────────────── shared settle / record path ──────────────────────

async function settleOrRecord(
  db: PrismaClient,
  provider: PaymentProvider,
  args: {
    order: Order;
    attempt: PaymentAttempt;
    payment: NormalizedPayment;
    providerPaymentId: string;
    source: "checkout" | "webhook" | "reconcile";
  },
): Promise<VerifyCheckoutResult> {
  const { order, attempt, payment, providerPaymentId, source } = args;

  // Already settled — never re-run settlement, never downgrade.
  if (attempt.status === "CAPTURED") {
    if (
      payment.status === "captured" &&
      attempt.providerPaymentId &&
      attempt.providerPaymentId !== providerPaymentId
    ) {
      // A different successful payment landed on the same order — the customer
      // paid twice. Record it, flag for a refund decision, do NOT re-confirm.
      await recordExcessCapture(db, {
        order,
        providerName: attempt.provider,
        providerOrderId: attempt.providerOrderId,
        providerPaymentId,
        amountPaise: payment.amountPaise,
        alsoPaymentId: attempt.providerPaymentId,
      });
      return { order, outcome: "review" };
    }
    return { order, outcome: order.orderStatus === "NEEDS_REVIEW" ? "review" : "confirmed" };
  }
  if (
    order.orderStatus === "CONFIRMED" &&
    order.paymentStatus === "PAID" &&
    payment.status !== "captured"
  ) {
    return { order, outcome: "confirmed" };
  }

  if (payment.status === "captured") {
    const otherCaptured = await db.paymentAttempt.findFirst({
      where: {
        orderId: order.id,
        status: "CAPTURED",
        providerPaymentId: { not: providerPaymentId },
      },
    });

    await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        providerPaymentId,
        status: "CAPTURED",
        verification: verificationBlob(payment, source),
      },
    });

    if (otherCaptured) {
      await openOperationalTask(db, {
        dedupeKey: `payment-review:${order.id}`,
        type: "PAYMENT_REVIEW",
        entityType: "Order",
        entityId: order.id,
        priority: 1,
        reason: `excess capture: ${providerPaymentId} in addition to ${otherCaptured.providerPaymentId}`,
      });
      await db.$transaction((tx) =>
        appendOrderTimeline(tx, {
          orderId: order.id,
          type: "payment.excess_capture",
          payload: { providerPaymentId, alsoCaptured: otherCaptured.providerPaymentId },
        }),
      );
      return { order, outcome: "review" };
    }

    if (order.orderStatus === "CONFIRMED" && order.paymentStatus === "PAID") {
      return { order, outcome: "confirmed" };
    }

    await runOnce(db, {
      executionKey: `settle:${order.id}`,
      handlerName: "settle-captured-payment",
      eventId: attempt.id,
      run: async () => {
        const r = await settleCapturedPayment(db, {
          orderId: order.id,
          capturedAmountPaise: payment.capturedAmountPaise,
        });
        return { result: r.outcome, providerRef: providerPaymentId };
      },
    });

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    if (fresh.orderStatus === "NEEDS_REVIEW") {
      await openOperationalTask(db, {
        dedupeKey: `payment-review:${order.id}`,
        type: "PAYMENT_REVIEW",
        entityType: "Order",
        entityId: order.id,
        priority: 1,
        reason: "payment captured after reservation expiry — stock could not be reacquired",
      });
      return { order: fresh, outcome: "review" };
    }
    return { order: fresh, outcome: "confirmed" };
  }

  if (payment.status === "authorized") {
    await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        providerPaymentId,
        status: "AUTHORIZED",
        verification: verificationBlob(payment, source),
      },
    });
    await db.$transaction((tx) =>
      appendOrderTimeline(tx, {
        orderId: order.id,
        type: "payment.authorized",
        payload: { providerPaymentId },
      }),
    );
    return { order, outcome: "authorized_pending" };
  }

  if (payment.status === "failed") {
    await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        providerPaymentId,
        status: "FAILED",
        verification: verificationBlob(payment, source),
      },
    });
    await db.$transaction((tx) =>
      appendOrderTimeline(tx, {
        orderId: order.id,
        type: "payment.failed",
        payload: { providerPaymentId },
      }),
    );
    return { order, outcome: "failed" };
  }

  return { order, outcome: "authorized_pending" };
}

// ─────────────────────── customer-facing checkout callback ───────────────────

/**
 * Verify the browser checkout handoff (master §8). Signature AND server-known
 * order/amount/INR-currency/captured-state are all required; a valid signature
 * with a wrong amount is a real payment that goes to review, never a silent
 * failure.
 */
export async function verifyPrepaidCheckout(
  db: PrismaClient,
  provider: PaymentProvider,
  input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  },
): Promise<VerifyCheckoutResult> {
  const attempt = await db.paymentAttempt.findFirst({
    where: { provider: provider.name, providerOrderId: input.providerOrderId },
    orderBy: { createdAt: "desc" },
  });
  if (!attempt) throw new PaymentVerificationError("unknown provider order");
  const order = await db.order.findUniqueOrThrow({ where: { id: attempt.orderId } });

  if (
    !provider.verifyCheckoutSignature({
      providerOrderId: input.providerOrderId,
      providerPaymentId: input.providerPaymentId,
      signature: input.signature,
    })
  ) {
    throw new PaymentVerificationError("signature");
  }

  const payment = await provider.fetchPayment(input.providerPaymentId);
  const mismatches: string[] = [];
  if (payment.providerOrderId !== input.providerOrderId) mismatches.push("order_id");
  if (payment.currency !== "INR") mismatches.push(`currency:${payment.currency}`);
  if (
    payment.status === "captured" &&
    payment.amountPaise !== order.totalPaise
  ) {
    mismatches.push(`amount:${payment.amountPaise}!=${order.totalPaise}`);
  }
  if (mismatches.length > 0) {
    await flagForReview(
      db,
      order,
      attempt,
      `checkout callback mismatch: ${mismatches.join(", ")}`,
      { providerPaymentId: input.providerPaymentId },
    );
    throw new PaymentMismatchError(mismatches);
  }

  return settleOrRecord(db, provider, {
    order,
    attempt,
    payment,
    providerPaymentId: input.providerPaymentId,
    source: "checkout",
  });
}

// ─────────────────────────────── webhook inbox ──────────────────────────────

export interface WebhookHandlingResult {
  httpStatus: number;
  body: unknown;
}

/**
 * Ingest and process one provider webhook (master §8). Verify raw bytes → store
 * & dedupe BEFORE acknowledging → process idempotently. Persistence failure →
 * 500 so the provider redelivers. Bad signature → 401. A processing error →
 * 500 (retriable). "Unknown order" is not an error: it opens a review task and
 * still acknowledges so the provider stops retrying.
 */
export async function handleProviderWebhook(
  db: PrismaClient,
  provider: PaymentProvider,
  input: { rawBody: Buffer; headers: Headers },
): Promise<WebhookHandlingResult> {
  let ingest;
  try {
    ingest = await ingestWebhook(db, {
      provider: provider.name,
      rawBody: input.rawBody,
      headers: input.headers,
      verify: (b, h) => {
        const v = provider.verifyWebhook(b, h);
        return { externalEventId: v.externalEventId, eventType: v.eventType, parsed: v };
      },
    });
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      return { httpStatus: 401, body: { error: "invalid signature" } };
    }
    return { httpStatus: 500, body: { error: "persistence failure" } };
  }

  if (!ingest.isNew) {
    return { httpStatus: 200, body: { deduplicated: true } };
  }

  try {
    await processWebhookEvent(
      db,
      provider,
      ingest.event.payload as unknown as VerifiedProviderWebhook,
    );
    await markWebhookProcessed(db, ingest.event.id);
    return { httpStatus: 200, body: { ok: true } };
  } catch (e) {
    await markWebhookFailed(
      db,
      ingest.event.id,
      e instanceof Error ? e.message : String(e),
    );
    return { httpStatus: 500, body: { error: "processing failed" } };
  }
}

async function processWebhookEvent(
  db: PrismaClient,
  provider: PaymentProvider,
  v: VerifiedProviderWebhook,
): Promise<void> {
  switch (v.eventType) {
    case "payment.captured":
    case "payment.authorized":
    case "payment.failed": {
      const hint = v.payment;
      if (!hint) return;
      // Reconcile the critical transition against provider truth, not the wire.
      const payment =
        v.eventType === "payment.captured"
          ? await provider.fetchPayment(hint.providerPaymentId)
          : hint;

      const attempt = payment.providerOrderId
        ? await db.paymentAttempt.findFirst({
            where: {
              provider: provider.name,
              providerOrderId: payment.providerOrderId,
            },
            orderBy: { createdAt: "desc" },
          })
        : await db.paymentAttempt.findFirst({
            where: {
              provider: provider.name,
              providerPaymentId: payment.providerPaymentId,
            },
          });

      if (!attempt) {
        await openOperationalTask(db, {
          dedupeKey: `payment-review:webhook:${payment.providerPaymentId}`,
          type: "PAYMENT_REVIEW",
          reason: `${v.eventType} for an unknown provider order ${payment.providerOrderId ?? "?"}`,
        });
        return;
      }

      const order = await db.order.findUniqueOrThrow({
        where: { id: attempt.orderId },
      });
      if (order.paymentMethod !== "PREPAID_RAZORPAY") {
        await openOperationalTask(db, {
          dedupeKey: `payment-review:${order.id}`,
          type: "PAYMENT_REVIEW",
          entityType: "Order",
          entityId: order.id,
          reason: `prepaid webhook ${v.eventType} received for a non-prepaid order`,
        });
        return;
      }

      const mismatches: string[] = [];
      if (payment.currency !== "INR") mismatches.push(`currency:${payment.currency}`);
      if (
        v.eventType === "payment.captured" &&
        payment.amountPaise !== order.totalPaise
      ) {
        mismatches.push(`amount:${payment.amountPaise}!=${order.totalPaise}`);
      }
      if (mismatches.length > 0) {
        await flagForReview(
          db,
          order,
          attempt,
          `webhook ${v.eventType} mismatch: ${mismatches.join(", ")}`,
          { providerPaymentId: payment.providerPaymentId },
        );
        return;
      }

      await settleOrRecord(db, provider, {
        order,
        attempt,
        payment,
        providerPaymentId: payment.providerPaymentId,
        source: "webhook",
      });
      return;
    }

    case "refund.created":
    case "refund.processed":
    case "refund.failed": {
      const r = v.refund;
      if (!r) return;
      const refund = await db.refund.findFirst({
        where: {
          provider: provider.name,
          OR: [
            { providerRefundId: r.providerRefundId },
            { paymentAttempt: { providerPaymentId: r.providerPaymentId } },
          ],
        },
      });
      if (!refund) {
        await openOperationalTask(db, {
          dedupeKey: `refund-review:${r.providerRefundId}`,
          type: "REFUND_FAILURE",
          reason: `${v.eventType} for a refund with no local record`,
        });
        return;
      }
      const status =
        r.status === "processed"
          ? "COMPLETED"
          : r.status === "failed"
            ? "FAILED"
            : "PROCESSING";
      await db.refund.update({
        where: { id: refund.id },
        data: {
          providerRefundId: r.providerRefundId,
          status,
          completedAt: status === "COMPLETED" ? new Date() : null,
        },
      });
      await recomputeOrderPaymentStatus(db, refund.orderId);
      return;
    }

    default:
      return; // event type we do not act on
  }
}

// ───────────────────────── aggregate payment status ─────────────────────────

async function recomputeOrderPaymentStatus(
  db: PrismaClient,
  orderId: string,
): Promise<void> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const [attempts, refunds] = await Promise.all([
    db.paymentAttempt.findMany({ where: { orderId } }),
    db.refund.findMany({ where: { orderId } }),
  ]);
  const capturedAmountPaise = attempts
    .filter((a) => a.status === "CAPTURED")
    .reduce((s, a) => s + a.amountPaise, 0);
  const refundedAmountPaise = refunds
    .filter((r) => r.status === "COMPLETED")
    .reduce((s, r) => s + r.amountPaise, 0);

  const next = deriveAggregatePaymentStatus({
    method: order.paymentMethod,
    attempts: attempts.map((a) => ({ status: a.status })),
    refunds: refunds.map((r) => ({ status: r.status, amountPaise: r.amountPaise })),
    capturedAmountPaise,
    refundedAmountPaise,
  });

  if (next !== order.paymentStatus) {
    await db.order.update({
      where: { id: orderId, version: order.version },
      data: { paymentStatus: next, version: { increment: 1 } },
    });
  }
}

// ───────────────────────── scheduled reconciliation ─────────────────────────

/**
 * `ReconcilePort` for the payment-reconciliation cron (master §8). Polls the
 * provider for attempts stuck in a non-terminal state and drives them forward,
 * catching missed or dropped webhooks.
 */
export function makePaymentReconcilePort(
  db: PrismaClient,
  provider: PaymentProvider,
  opts: { staleAfterMs?: number; limit?: number } = {},
): ReconcilePort {
  const staleAfterMs = opts.staleAfterMs ?? 15 * 60_000;
  const limit = opts.limit ?? 50;
  return {
    name: "razorpay-payments",
    async reconcilePending(now) {
      const cutoff = new Date(now.getTime() - staleAfterMs);
      const stale = await db.paymentAttempt.findMany({
        where: {
          provider: provider.name,
          status: { in: [...SETTLEABLE_ATTEMPT] },
          providerOrderId: { not: null },
          updatedAt: { lt: cutoff },
          order: {
            orderStatus: "PENDING_PAYMENT",
            paymentMethod: "PREPAID_RAZORPAY",
          },
        },
        take: limit,
        orderBy: { updatedAt: "asc" },
      });

      let updated = 0;
      let unresolved = 0;
      for (const attempt of stale) {
        try {
          const payments = await provider.fetchOrderPayments(
            attempt.providerOrderId!,
          );
          const captured = payments.find((p) => p.status === "captured");
          const authorized = payments.find((p) => p.status === "authorized");
          const order = await db.order.findUniqueOrThrow({
            where: { id: attempt.orderId },
          });

          if (captured) {
            await settleOrRecord(db, provider, {
              order,
              attempt,
              payment: captured,
              providerPaymentId: captured.providerPaymentId,
              source: "reconcile",
            });
            updated += 1;
          } else if (authorized) {
            await db.paymentAttempt.update({
              where: { id: attempt.id },
              data: {
                providerPaymentId: authorized.providerPaymentId,
                status: "AUTHORIZED",
              },
            });
            updated += 1;
          } else if (
            payments.length > 0 &&
            payments.every((p) => p.status === "failed")
          ) {
            await db.paymentAttempt.update({
              where: { id: attempt.id },
              data: { status: "FAILED" },
            });
            updated += 1;
          } else {
            unresolved += 1;
          }
        } catch {
          unresolved += 1;
        }
      }
      return { checked: stale.length, updated, unresolved };
    },
  };
}

// ──────────────────────────── refund primitive ──────────────────────────────

/**
 * Create a refund against a captured payment (master §8 create-refund/fetch-
 * refund primitive). Enforces the aggregate limit — pending + completed
 * refunds must not exceed the captured total — under concurrency by locking the
 * order row. The full admin refund WORKFLOW (authorisation UI, restock
 * decisions, credit notes) is Phase 9; this is the callable primitive it uses.
 */
export async function createOrderRefund(
  db: PrismaClient,
  provider: PaymentProvider,
  input: {
    orderId: string;
    amountPaise: number;
    reason?: string;
    requestedByAdminId?: string;
    actor?: string;
    operationKey?: string;
  },
): Promise<Refund> {
  const operationKey =
    input.operationKey ?? `refund:${input.orderId}:${input.amountPaise}`;
  const existing = await db.refund.findUnique({ where: { operationKey } });
  if (existing) return existing;

  const { refund, providerPaymentId } = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${input.orderId}::uuid FOR UPDATE`;

    const capturedAttempts = await tx.paymentAttempt.findMany({
      where: { orderId: input.orderId, status: "CAPTURED" },
    });
    if (capturedAttempts.length === 0) {
      throw new PaymentError("No captured payment on this order to refund.");
    }
    const capturedTotal = capturedAttempts.reduce((s, a) => s + a.amountPaise, 0);
    const outstanding = await tx.refund.aggregate({
      where: {
        orderId: input.orderId,
        status: { in: ["REQUESTED", "PROCESSING", "COMPLETED"] },
      },
      _sum: { amountPaise: true },
    });
    const already = outstanding._sum.amountPaise ?? 0;
    const refundable = capturedTotal - already;
    if (input.amountPaise <= 0 || input.amountPaise > refundable) {
      throw new RefundLimitError(input.amountPaise, Math.max(0, refundable));
    }

    const attempt = capturedAttempts[0];
    const created = await tx.refund.create({
      data: {
        orderId: input.orderId,
        paymentAttemptId: attempt.id,
        provider: provider.name,
        amountPaise: input.amountPaise,
        reason: input.reason ?? null,
        status: "REQUESTED",
        requestedById: input.requestedByAdminId ?? null,
        operationKey,
      },
    });
    await appendOrderTimeline(tx, {
      orderId: input.orderId,
      type: "refund.requested",
      payload: { refundId: created.id, amountPaise: input.amountPaise },
      actor: input.actor,
    });
    return { refund: created, providerPaymentId: attempt.providerPaymentId! };
  });

  try {
    const pr = await provider.createRefund({
      providerPaymentId,
      amountPaise: refund.amountPaise,
      operationKey,
      notes: { orderId: input.orderId },
    });
    const status =
      pr.status === "processed"
        ? "COMPLETED"
        : pr.status === "failed"
          ? "FAILED"
          : "PROCESSING";
    const done = await db.refund.update({
      where: { id: refund.id },
      data: {
        providerRefundId: pr.providerRefundId,
        status,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    });
    await recomputeOrderPaymentStatus(db, input.orderId);
    if (status === "FAILED") {
      await openOperationalTask(db, {
        dedupeKey: `refund-failure:${refund.id}`,
        type: "REFUND_FAILURE",
        entityType: "Refund",
        entityId: refund.id,
        reason: "provider reported the refund as failed",
      });
    }
    return done;
  } catch (e) {
    const failed = await db.refund.update({
      where: { id: refund.id },
      data: { status: "FAILED" },
    });
    await openOperationalTask(db, {
      dedupeKey: `refund-failure:${refund.id}`,
      type: "REFUND_FAILURE",
      entityType: "Refund",
      entityId: refund.id,
      reason: e instanceof Error ? e.message : String(e),
    });
    return failed;
  }
}

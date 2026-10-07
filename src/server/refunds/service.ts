import "server-only";

import type { PrismaClient, Refund } from "@/generated/prisma";
import { openOperationalTask } from "@/server/events/operational-tasks";
import { createInvoiceForOrder, issueCreditNote } from "@/server/invoices/service";
import { cancelOrder } from "@/server/orders/lifecycle";
import { appendOrderTimeline } from "@/server/orders/timeline";
import {
  createOrderRefund,
  type PaymentProvider,
} from "@/server/payments";
import type { ReconcilePort } from "@/server/webhooks/inbox";

/**
 * Refund WORKFLOW (master §6, §8). The concurrency-safe aggregate-limit
 * primitive is `createOrderRefund` in the payments domain; this layer adds the
 * admin-authorised request, the `refund.completed` domain event, and the credit
 * note — and the reconcile job for unknown provider outcomes. It NEVER touches
 * inventory (physical restock only follows an authorised return/RTO inspection).
 */

export interface RequestRefundInput {
  orderId: string;
  amountPaise: number;
  reason: string;
  /** Absent for the automatic late-capture refund (D-150). */
  adminUserId?: string;
  /** REFUND (default) / RETURN / CANCELLATION — flows to the credit note. */
  creditNoteReason?: "REFUND" | "RETURN" | "CANCELLATION" | "CORRECTION";
  operationKey?: string;
}

export async function requestRefund(
  db: PrismaClient,
  provider: PaymentProvider,
  input: RequestRefundInput,
): Promise<Refund> {
  // createOrderRefund enforces the aggregate limit and writes the
  // `refund.requested` timeline entry + domain event.
  const refund = await createOrderRefund(db, provider, {
    orderId: input.orderId,
    amountPaise: input.amountPaise,
    reason: input.reason,
    requestedByAdminId: input.adminUserId,
    actor: input.adminUserId,
    operationKey: input.operationKey,
  });

  if (refund.status === "COMPLETED") {
    await onRefundCompleted(db, refund, input.creditNoteReason ?? "REFUND");
  }
  return refund;
}

export const LATE_CAPTURE_CANCEL_REASON =
  "the piece sold out before your payment went through";

/**
 * Two buyers, one piece (D-150): a payment captured after the hold expired, and
 * someone else had already bought the stock (`settleCapturedPayment` →
 * NEEDS_REVIEW, timeline `order.late_capture_review`). Refund everything that
 * was captured and cancel the order, so the buyer gets the "cancelled" and
 * "refund completed" emails without the owner stepping in. Idempotent: the
 * refund's operation key is fixed, and an order that has left NEEDS_REVIEW
 * (the owner already dealt with it) is left alone.
 */
export async function refundLateCaptureShortfall(
  db: PrismaClient,
  provider: PaymentProvider,
  input: { orderId: string },
): Promise<{ outcome: "refunded" | "skipped"; refundId?: string }> {
  const order = await db.order.findUniqueOrThrow({ where: { id: input.orderId } });
  if (order.orderStatus !== "NEEDS_REVIEW" || order.fulfillmentStatus !== "UNFULFILLED") {
    return { outcome: "skipped" };
  }
  const [captured, refunded] = await Promise.all([
    db.paymentAttempt.aggregate({
      where: { orderId: order.id, status: "CAPTURED" },
      _sum: { amountPaise: true },
    }),
    db.refund.aggregate({
      where: { orderId: order.id, status: { in: ["REQUESTED", "PROCESSING", "COMPLETED"] } },
      _sum: { amountPaise: true },
    }),
  ]);
  const amountPaise = (captured._sum.amountPaise ?? 0) - (refunded._sum.amountPaise ?? 0);
  let refundId: string | undefined;
  if (amountPaise > 0) {
    const refund = await requestRefund(db, provider, {
      orderId: order.id,
      amountPaise,
      reason: "Sold out before payment completed (automatic)",
      creditNoteReason: "CANCELLATION",
      operationKey: `late-capture-refund:${order.id}`,
    });
    refundId = refund.id;
  }
  await cancelOrder(db, { orderId: order.id, reason: LATE_CAPTURE_CANCEL_REASON });
  return { outcome: "refunded", refundId };
}

/** Emit the completion event + issue the credit note. Idempotent. */
async function onRefundCompleted(
  db: PrismaClient,
  refund: Refund,
  creditNoteReason: "REFUND" | "RETURN" | "CANCELLATION" | "CORRECTION",
): Promise<void> {
  // ensure an invoice exists to credit against
  let invoice = await db.invoice.findUnique({ where: { orderId: refund.orderId } });
  if (!invoice) {
    try {
      invoice = await createInvoiceForOrder(db, { orderId: refund.orderId });
    } catch {
      invoice = null;
    }
  }
  if (invoice) {
    await issueCreditNote(db, {
      invoiceId: invoice.id,
      refundId: refund.id,
      reason: creditNoteReason,
      amountPaise: refund.amountPaise,
      note: refund.reason ?? undefined,
    });
  } else {
    await openOperationalTask(db, {
      dedupeKey: `credit-note:${refund.id}`,
      type: "INVOICE_FAILURE",
      entityType: "Refund",
      entityId: refund.id,
      reason: "refund completed but no invoice to credit against",
    });
  }

  // appendOrderTimeline emits the matching `refund.completed` domain event onto
  // the outbox (Phase 6), so notifications (Phase 10) react without re-deriving
  // from the timeline. One event only.
  await db.$transaction((tx) =>
    appendOrderTimeline(tx, {
      orderId: refund.orderId,
      type: "refund.completed",
      payload: {
        refundId: refund.id,
        amountPaise: refund.amountPaise,
        providerRefundId: refund.providerRefundId,
      },
    }),
  );
}

/**
 * `ReconcilePort` for the refund-reconciliation cron (master §8 — "unknown
 * refund outcome reconciled"). Polls non-terminal refunds and drives them from
 * provider truth.
 */
export function makeRefundReconcilePort(
  db: PrismaClient,
  provider: PaymentProvider,
  opts: { staleAfterMs?: number; limit?: number } = {},
): ReconcilePort {
  const staleAfterMs = opts.staleAfterMs ?? 10 * 60_000;
  const limit = opts.limit ?? 50;
  return {
    name: "razorpay-refunds",
    async reconcilePending(now) {
      const cutoff = new Date(now.getTime() - staleAfterMs);
      const pending = await db.refund.findMany({
        where: {
          provider: provider.name,
          status: { in: ["REQUESTED", "PROCESSING"] },
          providerRefundId: { not: null },
          updatedAt: { lt: cutoff },
        },
        take: limit,
        orderBy: { updatedAt: "asc" },
      });
      let updated = 0;
      let unresolved = 0;
      for (const refund of pending) {
        try {
          const r = await provider.fetchRefund(refund.providerRefundId!);
          const status =
            r.status === "processed"
              ? "COMPLETED"
              : r.status === "failed"
                ? "FAILED"
                : "PROCESSING";
          if (status === refund.status) {
            unresolved += 1;
            continue;
          }
          const done = await db.refund.update({
            where: { id: refund.id },
            data: {
              status,
              completedAt: status === "COMPLETED" ? new Date() : refund.completedAt,
            },
          });
          if (status === "COMPLETED") await onRefundCompleted(db, done, "REFUND");
          if (status === "FAILED") {
            await openOperationalTask(db, {
              dedupeKey: `refund-failure:${refund.id}`,
              type: "REFUND_FAILURE",
              entityType: "Refund",
              entityId: refund.id,
              reason: "provider reconciliation reported the refund failed",
            });
          }
          updated += 1;
        } catch {
          unresolved += 1;
        }
      }
      return { checked: pending.length, updated, unresolved };
    },
  };
}

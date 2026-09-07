import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { placeOrder, type AddressInput } from "../../src/server/checkout/place-order";
import { expireReservations } from "../../src/server/inventory/reservations";
import {
  CashfreeProvider,
} from "../../src/server/payments/cashfree";
import {
  PaymentError,
  PaymentMismatchError,
  PaymentVerificationError,
  ProviderDisabledError,
  RefundLimitError,
} from "../../src/server/payments/port";
import {
  createOrderRefund,
  createPaymentAttempt,
  handleProviderWebhook,
  makePaymentReconcilePort,
  verifyPrepaidCheckout,
} from "../../src/server/payments/service";
import { FakeRazorpay } from "../../src/server/payments/testing";
import { makeClient, resetDb } from "./helpers";

let db: PrismaClient;

beforeAll(() => {
  db = makeClient();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
  await db.storeSettings.create({
    data: {
      key: "business.profile",
      value: { legalName: "Test", gstin: "T", stateName: "Rajasthan", stateCode: "08" },
    },
  });
  await db.storeSettings.create({
    data: { key: "checkout.rules", value: { reservationTtlSeconds: 600, codFeePaise: 3000 } },
  });
});

let seq = 0;
async function makeVariant(opts: { onHand: number; pricePaise?: number; oneOfOne?: boolean }) {
  const isThrift = opts.oneOfOne ?? false;
  const p = await db.product.create({
    data: {
      catalog: isThrift ? "THRIFT" : "THE_POOJA_EDIT",
      slug: `p-${++seq}-${randomUUID().slice(0, 6)}`,
      title: `P${seq}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      ...(isThrift
        ? {
            thriftDetails: {
              create: { conditionGrade: "GOOD", measurements: {}, isOneOfOne: true },
            },
          }
        : {}),
    },
  });
  const v = await db.productVariant.create({
    data: {
      productId: p.id,
      sku: `SKU-${randomUUID().slice(0, 8)}`,
      pricePaise: opts.pricePaise ?? 149900,
      onHandQty: opts.onHand,
    },
  });
  return v.id;
}

const addr = (): AddressInput => ({
  name: "Buyer",
  phone: "+919999900000",
  line1: "1 St",
  city: "Jaipur",
  stateName: "Rajasthan",
  stateCode: "08",
  postcode: "302001",
});

async function placePrepaid(variantId: string, quantity = 1) {
  return placeOrder(db, {
    idempotencyKey: randomUUID(),
    scope: `guest:${randomUUID().slice(0, 12)}`,
    contact: { phone: "+919999900000", email: "g@example.invalid" },
    lines: [{ variantId, quantity }],
    paymentMethod: "PREPAID_RAZORPAY",
    billing: addr(),
    shipping: addr(),
  });
}

async function placeCod(variantId: string, quantity = 1) {
  return placeOrder(db, {
    idempotencyKey: randomUUID(),
    scope: `guest:${randomUUID().slice(0, 12)}`,
    contact: { phone: "+919999900000" },
    lines: [{ variantId, quantity }],
    paymentMethod: "COD",
    billing: addr(),
    shipping: addr(),
  });
}

// ───────────────────────────── checkout callback ────────────────────────────

describe("prepaid checkout callback (AC-06/07/08)", () => {
  it("a legitimate captured payment confirms the order and converts stock", async () => {
    const v = await makeVariant({ onHand: 3 });
    const { order } = await placePrepaid(v, 2);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });

    const pay = rzp.simulateCaptured(attempt.providerOrderId!);
    const res = await verifyPrepaidCheckout(db, rzp, {
      providerOrderId: attempt.providerOrderId!,
      providerPaymentId: pay.providerPaymentId,
      signature: rzp.signCheckout(attempt.providerOrderId!, pay.providerPaymentId),
    });

    expect(res.outcome).toBe("confirmed");
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("CONFIRMED");
    expect(fresh.paymentStatus).toBe("PAID");
    const vrow = await db.productVariant.findUniqueOrThrow({ where: { id: v } });
    expect(vrow.onHandQty).toBe(1);
    expect(vrow.reservedQty).toBe(0);
    expect(
      (await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status,
    ).toBe("CAPTURED");
    expect(
      await db.orderEvent.count({
        where: { orderId: order.id, type: "order.payment_settled" },
      }),
    ).toBe(1);
  });

  it("a forged browser success (bad signature) is rejected and nothing settles", async () => {
    const v = await makeVariant({ onHand: 2 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const pay = rzp.simulateCaptured(attempt.providerOrderId!);

    await expect(
      verifyPrepaidCheckout(db, rzp, {
        providerOrderId: attempt.providerOrderId!,
        providerPaymentId: pay.providerPaymentId,
        signature: "deadbeef".repeat(8), // not a valid HMAC
      }),
    ).rejects.toBeInstanceOf(PaymentVerificationError);

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("PENDING_PAYMENT");
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).reservedQty,
    ).toBe(1);
  });

  it("a valid signature with the wrong amount → NEEDS_REVIEW + one review task, no fulfilment", async () => {
    const v = await makeVariant({ onHand: 2, pricePaise: 100000 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const pay = rzp.simulateCaptured(attempt.providerOrderId!, {
      amountPaise: order.totalPaise - 5000,
    });

    await expect(
      verifyPrepaidCheckout(db, rzp, {
        providerOrderId: attempt.providerOrderId!,
        providerPaymentId: pay.providerPaymentId,
        signature: rzp.signCheckout(attempt.providerOrderId!, pay.providerPaymentId),
      }),
    ).rejects.toBeInstanceOf(PaymentMismatchError);

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("NEEDS_REVIEW");
    expect(fresh.fulfillmentStatus).toBe("UNFULFILLED");
    const tasks = await db.operationalTask.findMany({
      where: { dedupeKey: `payment-review:${order.id}` },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("OPEN");
  });

  it("a valid signature with the wrong currency → review", async () => {
    const v = await makeVariant({ onHand: 2 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const pay = rzp.simulateCaptured(attempt.providerOrderId!, { currency: "USD" });

    await expect(
      verifyPrepaidCheckout(db, rzp, {
        providerOrderId: attempt.providerOrderId!,
        providerPaymentId: pay.providerPaymentId,
        signature: rzp.signCheckout(attempt.providerOrderId!, pay.providerPaymentId),
      }),
    ).rejects.toBeInstanceOf(PaymentMismatchError);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).orderStatus,
    ).toBe("NEEDS_REVIEW");
  });

  it("authorised-but-not-captured leaves the order pending and unfulfilled", async () => {
    const v = await makeVariant({ onHand: 2 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const pay = rzp.simulateAuthorized(attempt.providerOrderId!);

    const res = await verifyPrepaidCheckout(db, rzp, {
      providerOrderId: attempt.providerOrderId!,
      providerPaymentId: pay.providerPaymentId,
      signature: rzp.signCheckout(attempt.providerOrderId!, pay.providerPaymentId),
    });

    expect(res.outcome).toBe("authorized_pending");
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("PENDING_PAYMENT");
    expect(fresh.paymentStatus).toBe("UNPAID");
    expect(
      (await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status,
    ).toBe("AUTHORIZED");
  });

  it("a crash after provider order creation is recovered by reusing the same attempt", async () => {
    const v = await makeVariant({ onHand: 2 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();

    rzp.failNextCreateOrder = true;
    await expect(createPaymentAttempt(db, rzp, { orderId: order.id })).rejects.toThrow();
    // one attempt row claimed, no provider order attached yet
    const after1 = await db.paymentAttempt.findMany({ where: { orderId: order.id } });
    expect(after1).toHaveLength(1);
    expect(after1[0].providerOrderId).toBeNull();

    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    expect(attempt.id).toBe(after1[0].id);
    expect(attempt.providerOrderId).not.toBeNull();
    expect(await db.paymentAttempt.count({ where: { orderId: order.id } })).toBe(1);
    expect(rzp.orders.size).toBe(1);
  });
});

// ──────────────────────────────── webhooks ──────────────────────────────────

describe("razorpay webhook inbox (AC-07)", () => {
  it("a duplicate captured webhook settles exactly once", async () => {
    const v = await makeVariant({ onHand: 3 });
    const { order } = await placePrepaid(v, 2);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const pay = rzp.simulateCaptured(attempt.providerOrderId!);
    const hook = rzp.buildWebhook(
      "payment.captured",
      { payment: pay },
      { eventId: "evt_dup_1" },
    );

    const r1 = await handleProviderWebhook(db, rzp, hook);
    const r2 = await handleProviderWebhook(db, rzp, hook);

    expect(r1.httpStatus).toBe(200);
    expect(r2.httpStatus).toBe(200);
    expect(r2.body).toMatchObject({ deduplicated: true });
    expect(await db.webhookEvent.count()).toBe(1);
    expect(
      await db.orderEvent.count({
        where: { orderId: order.id, type: "order.payment_settled" },
      }),
    ).toBe(1);
    const vrow = await db.productVariant.findUniqueOrThrow({ where: { id: v } });
    expect(vrow.onHandQty).toBe(1); // reduced once, not twice
  });

  it("a bad-signature webhook is rejected 401 and never persisted", async () => {
    const v = await makeVariant({ onHand: 2 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const pay = rzp.simulateCaptured(attempt.providerOrderId!);
    const hook = rzp.buildWebhook("payment.captured", { payment: pay });
    hook.headers.set("x-razorpay-signature", "0".repeat(64));

    const res = await handleProviderWebhook(db, rzp, hook);
    expect(res.httpStatus).toBe(401);
    expect(await db.webhookEvent.count()).toBe(0);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).orderStatus,
    ).toBe("PENDING_PAYMENT");
  });

  it("a stale payment.failed after capture does not downgrade a paid order", async () => {
    const v = await makeVariant({ onHand: 2 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const captured = rzp.simulateCaptured(attempt.providerOrderId!);
    await handleProviderWebhook(
      db,
      rzp,
      rzp.buildWebhook("payment.captured", { payment: captured }, { eventId: "evt_cap" }),
    );
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus,
    ).toBe("PAID");

    // a late failure for the same provider order
    const staleFail = { ...captured, status: "failed" as const };
    const res = await handleProviderWebhook(
      db,
      rzp,
      rzp.buildWebhook("payment.failed", { payment: staleFail }, { eventId: "evt_fail" }),
    );
    expect(res.httpStatus).toBe(200);
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.paymentStatus).toBe("PAID");
    expect(fresh.orderStatus).toBe("CONFIRMED");
  });

  it("a capture webhook after the reservation expired routes the order to review", async () => {
    const v = await makeVariant({ onHand: 1, oneOfOne: true, pricePaise: 50000 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });

    // reservation expires; the piece is then sold to someone else
    await db.inventoryReservation.updateMany({
      where: { orderId: order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await db.$transaction((tx) => expireReservations(tx, {}));
    await db.productVariant.update({ where: { id: v }, data: { onHandQty: 0 } });

    const pay = rzp.simulateCaptured(attempt.providerOrderId!);
    const res = await handleProviderWebhook(
      db,
      rzp,
      rzp.buildWebhook("payment.captured", { payment: pay }, { eventId: "evt_late" }),
    );
    expect(res.httpStatus).toBe(200);
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("NEEDS_REVIEW");
    expect(fresh.paymentStatus).toBe("PAID"); // real money — never hidden as failed
    expect(
      await db.operationalTask.count({
        where: { dedupeKey: `payment-review:${order.id}`, status: "OPEN" },
      }),
    ).toBe(1);
  });

  it("a second captured payment on a settled order is recorded as excess and flagged", async () => {
    const v = await makeVariant({ onHand: 3 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });

    const payA = rzp.simulateCaptured(attempt.providerOrderId!);
    await verifyPrepaidCheckout(db, rzp, {
      providerOrderId: attempt.providerOrderId!,
      providerPaymentId: payA.providerPaymentId,
      signature: rzp.signCheckout(attempt.providerOrderId!, payA.providerPaymentId),
    });

    const payB = rzp.simulateCaptured(attempt.providerOrderId!);
    const res = await verifyPrepaidCheckout(db, rzp, {
      providerOrderId: attempt.providerOrderId!,
      providerPaymentId: payB.providerPaymentId,
      signature: rzp.signCheckout(attempt.providerOrderId!, payB.providerPaymentId),
    });

    expect(res.outcome).toBe("review");
    expect(await db.paymentAttempt.count({ where: { orderId: order.id } })).toBe(2);
    expect(
      await db.operationalTask.count({
        where: { dedupeKey: `payment-review:${order.id}`, status: "OPEN" },
      }),
    ).toBe(1);
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("CONFIRMED"); // not confirmed twice
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(2); // reduced once
  });

  it("a webhook for an unknown provider order opens a review task and still acknowledges", async () => {
    const rzp = new FakeRazorpay();
    // fabricate a captured payment against an order we never created
    const pay = {
      providerPaymentId: "pay_ghost",
      providerOrderId: "order_ghost",
      status: "captured" as const,
      amountPaise: 9999,
      capturedAmountPaise: 9999,
      amountRefundedPaise: 0,
      currency: "INR",
      method: "upi",
      raw: {
        id: "pay_ghost",
        order_id: "order_ghost",
        status: "captured",
        amount: 9999,
        currency: "INR",
      },
    };
    rzp.payments.set("pay_ghost", {
      id: "pay_ghost",
      order_id: "order_ghost",
      status: "captured",
      amount: 9999,
      amount_refunded: 0,
      currency: "INR",
      method: "upi",
      captured: true,
    });
    const res = await handleProviderWebhook(
      db,
      rzp,
      rzp.buildWebhook("payment.captured", { payment: pay }, { eventId: "evt_ghost" }),
    );
    expect(res.httpStatus).toBe(200);
    expect(
      await db.operationalTask.count({
        where: { dedupeKey: "payment-review:webhook:pay_ghost" },
      }),
    ).toBe(1);
  });
});

// ─────────────────────────────── reconciliation ─────────────────────────────

describe("payment reconciliation (AC-08)", () => {
  it("settles an attempt whose capture webhook was missed", async () => {
    const v = await makeVariant({ onHand: 2 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    // customer paid, but no webhook / callback arrived
    rzp.simulateCaptured(attempt.providerOrderId!);
    // make the attempt look stale
    await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: { updatedAt: new Date(Date.now() - 60 * 60_000) },
    });

    const port = makePaymentReconcilePort(db, rzp, { staleAfterMs: 60_000 });
    const summary = await port.reconcilePending(new Date());
    expect(summary).toMatchObject({ checked: 1, updated: 1 });
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("CONFIRMED");
    expect(fresh.paymentStatus).toBe("PAID");
  });
});

// ─────────────────────────────── COD vs prepaid ────────────────────────────

describe("COD is never prepaid (AC-09)", () => {
  it("a COD order has no prepaid attempt and stays COD_PENDING", async () => {
    const v = await makeVariant({ onHand: 3 });
    const { order } = await placeCod(v, 2);
    const rzp = new FakeRazorpay();
    await expect(
      createPaymentAttempt(db, rzp, { orderId: order.id }),
    ).rejects.toBeInstanceOf(PaymentError);
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.paymentMethod).toBe("COD");
    expect(fresh.paymentStatus).toBe("COD_PENDING");
    expect(fresh.orderStatus).toBe("PENDING_CONFIRMATION");
  });
});

// ─────────────────────────────── refund primitive ──────────────────────────

describe("refund aggregate limit (master §8)", () => {
  it("concurrent refunds cannot exceed the captured amount", async () => {
    const v = await makeVariant({ onHand: 2, pricePaise: 100000 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const pay = rzp.simulateCaptured(attempt.providerOrderId!);
    await verifyPrepaidCheckout(db, rzp, {
      providerOrderId: attempt.providerOrderId!,
      providerPaymentId: pay.providerPaymentId,
      signature: rzp.signCheckout(attempt.providerOrderId!, pay.providerPaymentId),
    });
    const total = (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
      .totalPaise;

    const results = await Promise.allSettled([
      createOrderRefund(db, rzp, {
        orderId: order.id,
        amountPaise: total,
        operationKey: "r1",
      }),
      createOrderRefund(db, rzp, {
        orderId: order.id,
        amountPaise: total,
        operationKey: "r2",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      RefundLimitError,
    );
    const refunds = await db.refund.findMany({ where: { orderId: order.id } });
    const outstanding = refunds
      .filter((r) => r.status !== "FAILED")
      .reduce((s, r) => s + r.amountPaise, 0);
    expect(outstanding).toBeLessThanOrEqual(total);
  });

  it("a completed refund moves the order to REFUNDED", async () => {
    const v = await makeVariant({ onHand: 2, pricePaise: 100000 });
    const { order } = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const pay = rzp.simulateCaptured(attempt.providerOrderId!);
    await verifyPrepaidCheckout(db, rzp, {
      providerOrderId: attempt.providerOrderId!,
      providerPaymentId: pay.providerPaymentId,
      signature: rzp.signCheckout(attempt.providerOrderId!, pay.providerPaymentId),
    });
    const total = (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
      .totalPaise;

    const refund = await createOrderRefund(db, rzp, {
      orderId: order.id,
      amountPaise: total,
      reason: "customer request",
    });
    expect(refund.status).toBe("COMPLETED");
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus,
    ).toBe("REFUNDED");
  });
});

// ───────────────────────── provider-neutral interface ──────────────────────

describe("provider-neutral port", () => {
  it("Cashfree is interface-compatible but disabled", async () => {
    const cf = new CashfreeProvider();
    expect(cf.name).toBe("cashfree");
    expect(cf.enabled).toBe(false);
    expect(() =>
      cf.createOrder({
        amountPaise: 1,
        currency: "INR",
        receipt: "x",
        operationKey: "x",
      }),
    ).toThrow(ProviderDisabledError);
    expect(() =>
      cf.verifyCheckoutSignature({
        providerOrderId: "a",
        providerPaymentId: "b",
        signature: "c",
      }),
    ).toThrow(ProviderDisabledError);
  });
});

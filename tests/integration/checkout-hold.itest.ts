import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { holdForPayment } from "../../src/server/checkout/hold";
import { placeOrder, type AddressInput } from "../../src/server/checkout/place-order";
import { expireReservations } from "../../src/server/inventory/reservations";
import {
  createPaymentAttempt,
  handleProviderWebhook,
} from "../../src/server/payments/service";
import { FakeRazorpay } from "../../src/server/payments/testing";
import { refundLateCaptureShortfall } from "../../src/server/refunds/service";
import { makeClient, resetDb } from "./helpers";

/**
 * Two buyers, one piece (D-150): the hold is re-taken (or the order cancelled)
 * before Razorpay opens, and a payment that still lands after someone else
 * bought the piece is refunded and cancelled automatically.
 */

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
    data: {
      key: "checkout.rules",
      value: { reservationTtlSeconds: 600, codFeePaise: 3000 },
    },
  });
});

let seq = 0;
async function makePiece() {
  const p = await db.product.create({
    data: {
      catalog: "THRIFT",
      slug: `p-${++seq}-${randomUUID().slice(0, 6)}`,
      title: `P${seq}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      thriftDetails: {
        create: { conditionGrade: "GOOD", measurements: {}, isOneOfOne: true },
      },
    },
  });
  const v = await db.productVariant.create({
    data: {
      productId: p.id,
      sku: `SKU-${randomUUID().slice(0, 8)}`,
      pricePaise: 50000,
      onHandQty: 1,
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

async function placePrepaid(variantId: string) {
  const { order } = await placeOrder(db, {
    idempotencyKey: randomUUID(),
    scope: `guest:${randomUUID().slice(0, 12)}`,
    contact: { phone: "+919999900000", email: "g@example.invalid" },
    lines: [{ variantId, quantity: 1 }],
    paymentMethod: "PREPAID_RAZORPAY",
    billing: addr(),
    shipping: addr(),
  });
  return order;
}

async function expireHold(orderId: string, sweep = true) {
  await db.inventoryReservation.updateMany({
    where: { orderId },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  if (sweep) await db.$transaction((tx) => expireReservations(tx, {}));
}

const reserved = async (variantId: string) =>
  (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).reservedQty;

describe("holdForPayment", () => {
  it("a fresh order keeps its hold; the payment window closes 30 s before it ends", async () => {
    const v = await makePiece();
    const order = await placePrepaid(v);
    const before = await db.inventoryReservation.findFirstOrThrow({
      where: { orderId: order.id },
    });

    const r = await holdForPayment(db, { orderId: order.id });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.paymentWindowSeconds).toBeGreaterThan(500);
    expect(r.ok && r.paymentWindowSeconds).toBeLessThanOrEqual(570);
    const after = await db.inventoryReservation.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(after.expiresAt).toEqual(before.expiresAt); // not extended
    expect(await reserved(v)).toBe(1);
  });

  it("an expired, swept hold is re-taken when the piece is still free, and can expire again", async () => {
    const v = await makePiece();
    const order = await placePrepaid(v);
    await expireHold(order.id);
    expect(await reserved(v)).toBe(0);

    const r = await holdForPayment(db, { orderId: order.id });
    expect(r.ok).toBe(true);
    expect(await reserved(v)).toBe(1);
    const row = await db.inventoryReservation.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(row.status).toBe("ACTIVE");

    // Second expiry gets its own ledger entry (keys carry the hold's end).
    await expireHold(order.id);
    expect(await reserved(v)).toBe(0);
    expect(
      await db.inventoryTransaction.count({
        where: { orderId: order.id, type: "RELEASE", reason: "expired" },
      }),
    ).toBe(2);
  });

  it("an expired hold that was never swept is extended in place", async () => {
    const v = await makePiece();
    const order = await placePrepaid(v);
    await expireHold(order.id, false);

    const r = await holdForPayment(db, { orderId: order.id });
    expect(r.ok).toBe(true);
    expect(await reserved(v)).toBe(1); // not double-counted
    const row = await db.inventoryReservation.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + 500_000);
  });

  it("cancels the order instead of taking payment when someone else bought the piece", async () => {
    const v = await makePiece();
    const slow = await placePrepaid(v);
    await expireHold(slow.id);
    const fast = await placePrepaid(v); // takes the piece
    expect(await reserved(v)).toBe(1);

    const r = await holdForPayment(db, { orderId: slow.id });
    expect(r).toEqual({ ok: false, reason: "sold_out" });
    const fresh = await db.order.findUniqueOrThrow({ where: { id: slow.id } });
    expect(fresh.orderStatus).toBe("CANCELLED");
    expect(
      await db.orderEvent.count({
        where: { orderId: slow.id, type: "order.cancelled" },
      }),
    ).toBe(1);
    expect(await reserved(v)).toBe(1); // the other buyer's hold is untouched
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: fast.id } })).orderStatus,
    ).toBe("PENDING_PAYMENT");
  });

  it("refuses an order that is no longer awaiting payment", async () => {
    const v = await makePiece();
    const order = await placePrepaid(v);
    await db.order.update({
      where: { id: order.id },
      data: { orderStatus: "CANCELLED" },
    });
    expect(await holdForPayment(db, { orderId: order.id })).toEqual({
      ok: false,
      reason: "not_awaiting_payment",
    });
  });
});

describe("refundLateCaptureShortfall", () => {
  it("refunds the late payer in full and cancels the order, once", async () => {
    const v = await makePiece();
    const order = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    await expireHold(order.id);
    await db.productVariant.update({ where: { id: v }, data: { onHandQty: 0 } }); // sold elsewhere

    const pay = rzp.simulateCaptured(attempt.providerOrderId!);
    await handleProviderWebhook(
      db,
      rzp,
      rzp.buildWebhook("payment.captured", { payment: pay }, { eventId: "evt_late" }),
    );
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).orderStatus,
    ).toBe("NEEDS_REVIEW");
    expect(
      await db.orderEvent.count({
        where: { orderId: order.id, type: "order.late_capture_review" },
      }),
    ).toBe(1);

    const r = await refundLateCaptureShortfall(db, rzp, { orderId: order.id });
    expect(r.outcome).toBe("refunded");
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("CANCELLED");
    expect(fresh.paymentStatus).toBe("REFUNDED");
    const refunds = await db.refund.findMany({ where: { orderId: order.id } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amountPaise).toBe(fresh.totalPaise);
    expect(refunds[0].status).toBe("COMPLETED");

    // Redelivery is a no-op.
    expect(
      (await refundLateCaptureShortfall(db, rzp, { orderId: order.id })).outcome,
    ).toBe("skipped");
    expect(await db.refund.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("leaves an order alone once the owner has dealt with it", async () => {
    const v = await makePiece();
    const order = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    expect(
      (await refundLateCaptureShortfall(db, rzp, { orderId: order.id })).outcome,
    ).toBe("skipped");
  });
});

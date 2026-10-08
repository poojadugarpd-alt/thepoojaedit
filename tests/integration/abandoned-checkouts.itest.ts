import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { listOrders } from "../../src/server/admin/orders";
import { placeOrder, type AddressInput } from "../../src/server/checkout/place-order";
import { notifyForDomainEvent } from "../../src/server/notifications/service";
import { fakeTransports } from "../../src/server/notifications/testing";
import {
  cancelAbandonedCheckouts,
  cancelOrder,
} from "../../src/server/orders/lifecycle";
import {
  createPaymentAttempt,
  handleProviderWebhook,
} from "../../src/server/payments/service";
import { FakeRazorpay } from "../../src/server/payments/testing";
import { refundLateCaptureShortfall } from "../../src/server/refunds/service";
import { FakeShadowfax } from "../../src/server/shipping/testing";
import { makeClient, resetDb } from "./helpers";

/**
 * Unpaid online checkouts are cancelled 30 min after they start, without a
 * customer message; a payment that still lands afterwards is refunded (D-154).
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
async function makeVariant(onHand = 5) {
  const p = await db.product.create({
    data: {
      catalog: "THE_POOJA_EDIT",
      slug: `p-${++seq}-${randomUUID().slice(0, 6)}`,
      title: `P${seq}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  const v = await db.productVariant.create({
    data: {
      productId: p.id,
      sku: `SKU-${randomUUID().slice(0, 8)}`,
      pricePaise: 50000,
      onHandQty: onHand,
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

async function place(
  variantId: string,
  paymentMethod: "PREPAID_RAZORPAY" | "COD",
  minutesAgo: number,
) {
  const { order } = await placeOrder(db, {
    idempotencyKey: randomUUID(),
    scope: `guest:${randomUUID().slice(0, 12)}`,
    contact: { phone: "+919999900000", email: "g@example.invalid" },
    lines: [{ variantId, quantity: 1 }],
    paymentMethod,
    billing: addr(),
    shipping: addr(),
    shippingPort: new FakeShadowfax(),
  });
  return db.order.update({
    where: { id: order.id },
    data: { placedAt: new Date(Date.now() - minutesAgo * 60_000) },
  });
}

const status = async (id: string) =>
  (await db.order.findUniqueOrThrow({ where: { id } })).orderStatus;

async function cancellationMessages(orderId: string) {
  const ev = await db.domainEvent.findFirstOrThrow({
    where: { aggregateId: orderId, type: "order.cancelled" },
  });
  const t = fakeTransports(db);
  await notifyForDomainEvent(
    db,
    {
      domainEventId: ev.id,
      type: ev.type,
      aggregateType: ev.aggregateType,
      aggregateId: ev.aggregateId,
      payload: ev.payload,
    },
    t,
  );
  return t.email.sent.length + t.whatsapp.sent.length;
}

describe("cancelAbandonedCheckouts", () => {
  it("cancels only prepaid checkouts unpaid for 30+ min, silently, and frees their stock", async () => {
    const v = await makeVariant();
    const stale = await place(v, "PREPAID_RAZORPAY", 31);
    const fresh = await place(v, "PREPAID_RAZORPAY", 29);
    const cod = await place(v, "COD", 120);

    const r = await cancelAbandonedCheckouts(db);
    expect(r.cancelled).toEqual([stale.orderNumber]);
    expect(await status(stale.id)).toBe("CANCELLED");
    expect(await status(fresh.id)).toBe("PENDING_PAYMENT");
    expect(await status(cod.id)).toBe("PENDING_CONFIRMATION");
    expect(
      await db.inventoryReservation.count({
        where: { orderId: stale.id, status: "ACTIVE" },
      }),
    ).toBe(0);

    // No "order cancelled" email or WhatsApp for an abandoned checkout.
    expect(await cancellationMessages(stale.id)).toBe(0);

    // Running again changes nothing.
    expect((await cancelAbandonedCheckouts(db)).cancelled).toEqual([]);
  });

  it("leaves a checkout whose payment is authorised (settling, not abandoned)", async () => {
    const v = await makeVariant();
    const order = await place(v, "PREPAID_RAZORPAY", 45);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "AUTHORIZED" },
    });
    expect((await cancelAbandonedCheckouts(db)).cancelled).toEqual([]);
    expect(await status(order.id)).toBe("PENDING_PAYMENT");
  });

  it("a cancel by the owner still messages the customer", async () => {
    const v = await makeVariant();
    const order = await place(v, "PREPAID_RAZORPAY", 1);
    await cancelOrder(db, { orderId: order.id, reason: "out of stock" });
    expect(await cancellationMessages(order.id)).toBeGreaterThan(0);
  });

  it("drops out of the Unpaid checkouts view once cancelled; still found by search", async () => {
    const v = await makeVariant();
    const stale = await place(v, "PREPAID_RAZORPAY", 40);
    const open = await place(v, "PREPAID_RAZORPAY", 5);
    await cancelAbandonedCheckouts(db);

    const unpaidView = await listOrders(db, { unpaid: "only" });
    expect(unpaidView.rows.map((r) => r.orderNumber)).toEqual([open.orderNumber]);
    const defaultList = await listOrders(db);
    expect(defaultList.rows.map((r) => r.orderNumber)).not.toContain(stale.orderNumber);
    const search = await listOrders(db, { q: stale.orderNumber });
    expect(search.rows.map((r) => r.orderNumber)).toEqual([stale.orderNumber]);
  });
});

describe("a payment that lands after the checkout was cancelled", () => {
  it("is never turned back into a live order, even with stock free; it is refunded in full", async () => {
    const v = await makeVariant(5);
    const order = await place(v, "PREPAID_RAZORPAY", 35);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    await cancelAbandonedCheckouts(db);
    expect(await status(order.id)).toBe("CANCELLED");

    const pay = rzp.simulateCaptured(attempt.providerOrderId!);
    await handleProviderWebhook(
      db,
      rzp,
      rzp.buildWebhook(
        "payment.captured",
        { payment: pay },
        { eventId: "evt_slow_upi" },
      ),
    );
    const review = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(review.orderStatus).toBe("NEEDS_REVIEW");
    expect(review.fulfillmentStatus).toBe("UNFULFILLED");
    // Stock was not taken back for it.
    expect(
      await db.inventoryReservation.count({
        where: { orderId: order.id, status: { in: ["ACTIVE", "CONVERTED"] } },
      }),
    ).toBe(0);

    const r = await refundLateCaptureShortfall(db, rzp, { orderId: order.id });
    expect(r.outcome).toBe("refunded");
    const done = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(done.orderStatus).toBe("CANCELLED");
    expect(done.paymentStatus).toBe("REFUNDED");
    expect(await db.refund.count({ where: { orderId: order.id } })).toBe(1);
  });
});

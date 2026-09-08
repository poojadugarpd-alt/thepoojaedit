import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { ResourceNotFoundError } from "../../src/server/auth/errors";
import { placeOrder, type AddressInput } from "../../src/server/checkout/place-order";
import { getViewableOrder } from "../../src/server/orders";
import { issueOrderAccessToken } from "../../src/server/orders/access-tokens";
import {
  createPaymentAttempt,
  handleProviderWebhook,
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
      value: { legalName: "Fixture", gstin: "08AAAAA0000A1Z5", stateName: "Rajasthan", stateCode: "08" },
    },
  });
  await db.storeSettings.create({
    data: { key: "checkout.rules", value: { reservationTtlSeconds: 600, codFeePaise: 3000 } },
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
    data: { productId: p.id, sku: `SKU-${randomUUID().slice(0, 8)}`, pricePaise: 100000, onHandQty: onHand },
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
async function placePrepaid(variantId: string, customerId?: string) {
  const { order } = await placeOrder(db, {
    idempotencyKey: randomUUID(),
    scope: customerId ? `customer:${customerId}` : `guest:${randomUUID().slice(0, 12)}`,
    customerId: customerId ?? null,
    contact: { phone: "+919999900000", email: "b@example.invalid" },
    lines: [{ variantId, quantity: 1 }],
    paymentMethod: "PREPAID_RAZORPAY",
    billing: addr(),
    shipping: addr(),
  });
  return order;
}

const settledEvents = (orderId: string) =>
  db.orderEvent.count({ where: { orderId, type: "order.payment_settled" } });

// ─────────── browser return vs webhook — both orderings settle once ──────────

describe("prepaid settlement is order-independent (AC-07)", () => {
  it("browser return BEFORE the webhook — webhook is a no-op", async () => {
    const v = await makeVariant();
    const order = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const pay = rzp.simulateCaptured(attempt.providerOrderId!);

    // (1) browser checkout callback
    const cb = await verifyPrepaidCheckout(db, rzp, {
      providerOrderId: attempt.providerOrderId!,
      providerPaymentId: pay.providerPaymentId,
      signature: rzp.signCheckout(attempt.providerOrderId!, pay.providerPaymentId),
    });
    expect(cb.outcome).toBe("confirmed");

    // (2) the webhook arrives later
    const hook = rzp.buildWebhook("payment.captured", { payment: pay }, { eventId: "evt_after" });
    const wh = await handleProviderWebhook(db, rzp, hook);
    expect(wh.httpStatus).toBe(200);

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.orderStatus).toBe("CONFIRMED");
    expect(fresh.paymentStatus).toBe("PAID");
    expect(await settledEvents(order.id)).toBe(1);
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(4); // converted once
  });

  it("webhook BEFORE the browser return — the browser callback is a no-op", async () => {
    const v = await makeVariant();
    const order = await placePrepaid(v);
    const rzp = new FakeRazorpay();
    const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
    const pay = rzp.simulateCaptured(attempt.providerOrderId!);

    // (1) webhook first
    const hook = rzp.buildWebhook("payment.captured", { payment: pay }, { eventId: "evt_first" });
    const wh = await handleProviderWebhook(db, rzp, hook);
    expect(wh.httpStatus).toBe(200);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).orderStatus,
    ).toBe("CONFIRMED");

    // (2) the browser returns afterwards
    const cb = await verifyPrepaidCheckout(db, rzp, {
      providerOrderId: attempt.providerOrderId!,
      providerPaymentId: pay.providerPaymentId,
      signature: rzp.signCheckout(attempt.providerOrderId!, pay.providerPaymentId),
    });
    expect(cb.outcome).toBe("confirmed");

    expect(await settledEvents(order.id)).toBe(1);
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(4);
  });
});

// ───────────────── account isolation + guest-token access (AC-03/12) ─────────

describe("order-view authorization", () => {
  it("a customer sees only their own order; another's is a generic not-found", async () => {
    const alice = await db.customer.create({ data: { authUserId: randomUUID() } });
    const bob = await db.customer.create({ data: { authUserId: randomUUID() } });
    const v1 = await makeVariant();
    const v2 = await makeVariant();
    const aliceOrder = await placePrepaid(v1, alice.id);
    const bobOrder = await placePrepaid(v2, bob.id);

    await expect(
      getViewableOrder(db, { orderNumber: aliceOrder.orderNumber, customerId: alice.id }),
    ).resolves.toMatchObject({ orderNumber: aliceOrder.orderNumber });

    await expect(
      getViewableOrder(db, { orderNumber: bobOrder.orderNumber, customerId: alice.id }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("a guest order is reachable only with its ORDER_VIEW token; a wrong token is not-found", async () => {
    const v = await makeVariant();
    const order = await placePrepaid(v); // guest
    const { token } = await issueOrderAccessToken(db, {
      orderId: order.id,
      scope: "ORDER_VIEW",
      ttlSeconds: 3600,
    });

    await expect(
      getViewableOrder(db, { orderNumber: order.orderNumber, token }),
    ).resolves.toMatchObject({ orderNumber: order.orderNumber });

    await expect(
      getViewableOrder(db, { orderNumber: order.orderNumber, token: "not-a-real-token" }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    // a customer id that doesn't own it → not-found (no contact-based linking)
    const someone = await db.customer.create({ data: { authUserId: randomUUID() } });
    await expect(
      getViewableOrder(db, { orderNumber: order.orderNumber, customerId: someone.id }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});

// ───────────────────────── invoice download route auth ──────────────────────

describe("invoice PDF route authorization (AC-12)", () => {
  it("denies without a token / with a wrong token, allows with the ORDER_VIEW token", async () => {
    const { GET } = await import("../../src/app/order/[orderNumber]/invoice/route");
    const { issueInvoiceForOrder, renderAndStoreInvoicePdf } = await import(
      "../../src/server/invoices"
    );
    const { confirmCodOrder } = await import("../../src/server/orders/lifecycle");

    const v = await makeVariant();
    const { order } = await placeOrder(db, {
      idempotencyKey: randomUUID(),
      scope: `guest:${randomUUID().slice(0, 12)}`,
      contact: { phone: "+919999900000" },
      lines: [{ variantId: v, quantity: 1 }],
      paymentMethod: "COD",
      billing: addr(),
      shipping: addr(),
    });
    await confirmCodOrder(db, { orderId: order.id });
    const invoice = await issueInvoiceForOrder(order.id);
    await renderAndStoreInvoicePdf(invoice.id);
    const { token } = await issueOrderAccessToken(db, {
      orderId: order.id,
      scope: "ORDER_VIEW",
      ttlSeconds: 3600,
    });

    const call = (qs: string) =>
      GET(new Request(`http://localhost/order/${order.orderNumber}/invoice${qs}`), {
        params: Promise.resolve({ orderNumber: order.orderNumber }),
      });

    expect((await call("")).status).toBe(404); // no auth
    expect((await call("?token=wrong")).status).toBe(404);
    const ok = await call(`?token=${encodeURIComponent(token)}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(ok.headers.get("cache-control")).toContain("no-store");
  });
});

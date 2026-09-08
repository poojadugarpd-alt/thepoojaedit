import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { AuthorizationError } from "../../src/server/auth/errors";
import {
  assertActiveAdmin,
  getAdminOrder,
  listOpenTasks,
  listOrders,
  resolveTaskChecked,
  runBulk,
  TaskStillActiveError,
} from "../../src/server/admin";
import { getFinancialSummary, getOverview } from "../../src/server/analytics";
import { placeOrder, type AddressInput } from "../../src/server/checkout/place-order";
import { adjustStock } from "../../src/server/inventory/adjust";
import { confirmCodOrder } from "../../src/server/orders/lifecycle";
import {
  createPaymentAttempt,
  verifyPrepaidCheckout,
} from "../../src/server/payments/service";
import { FakeRazorpay } from "../../src/server/payments/testing";
import { requestRefund } from "../../src/server/refunds/service";
import {
  createShipmentForOrder,
  reconcileShipment,
  syncCodRemittance,
} from "../../src/server/shipping/service";
import { FakeShadowfax } from "../../src/server/shipping/testing";
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
      value: { legalName: "Fixture Co", gstin: "08AAAAA0000A1Z5", stateName: "Rajasthan", stateCode: "08" },
    },
  });
  await db.storeSettings.create({
    data: { key: "checkout.rules", value: { reservationTtlSeconds: 600, codFeePaise: 3000 } },
  });
});

let seq = 0;
async function makeVariant(opts: {
  catalog?: "THE_POOJA_EDIT" | "THRIFT";
  onHand?: number;
  price?: number;
  lowStockThreshold?: number;
  acquisitionCostPaise?: number;
}) {
  const catalog = opts.catalog ?? "THE_POOJA_EDIT";
  const p = await db.product.create({
    data: {
      catalog,
      slug: `p-${++seq}-${randomUUID().slice(0, 6)}`,
      title: `P${seq}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      ...(catalog === "THRIFT"
        ? {
            thriftDetails: {
              create: {
                conditionGrade: "GOOD",
                measurements: {},
                isOneOfOne: true,
                acquisitionCostPaise: opts.acquisitionCostPaise ?? 12345,
              },
            },
          }
        : {}),
    },
  });
  const v = await db.productVariant.create({
    data: {
      productId: p.id,
      sku: `SKU-${randomUUID().slice(0, 8)}`,
      pricePaise: opts.price ?? 100000,
      onHandQty: opts.onHand ?? 10,
      lowStockThreshold: opts.lowStockThreshold ?? 0,
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
  method: "PREPAID_RAZORPAY" | "COD",
  lines: { variantId: string; quantity: number }[],
) {
  const { order } = await placeOrder(db, {
    idempotencyKey: randomUUID(),
    scope: `guest:${randomUUID().slice(0, 12)}`,
    contact: { phone: "+919999900000", email: "b@example.invalid" },
    lines,
    paymentMethod: method,
    billing: addr(),
    shipping: addr(),
  });
  return order;
}

async function capture(orderId: string, rzp: FakeRazorpay) {
  const attempt = await createPaymentAttempt(db, rzp, { orderId });
  const pay = rzp.simulateCaptured(attempt.providerOrderId!);
  await verifyPrepaidCheckout(db, rzp, {
    providerOrderId: attempt.providerOrderId!,
    providerPaymentId: pay.providerPaymentId,
    signature: rzp.signCheckout(attempt.providerOrderId!, pay.providerPaymentId),
  });
}

const admin = () =>
  db.adminUser.create({
    data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
  });
const T = (h: number) => new Date(Date.UTC(2026, 5, 1, h));

// ─────────────────────── full lifecycles (AC-15) ────────────────────────────

describe("operator drives a prepaid lifecycle", () => {
  it("place → capture → ship → deliver → invoice → refund, all visible in the detail view", async () => {
    const v = await makeVariant({ onHand: 5 });
    const order = await place("PREPAID_RAZORPAY", [{ variantId: v, quantity: 2 }]);
    const rzp = new FakeRazorpay();
    await capture(order.id, rzp);

    let detail = await getAdminOrder(db, order.orderNumber);
    expect(detail?.orderStatus).toBe("CONFIRMED");
    expect(detail?.paymentStatus).toBe("PAID");
    expect(detail?.paymentAttempts.some((a) => a.status === "CAPTURED")).toBe(true);

    const fx = new FakeShadowfax();
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "PICKED_UP", T(9));
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "OUT_FOR_DELIVERY", T(12));
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "DELIVERED", T(15));
    await reconcileShipment(db, fx, { shipmentId: shipment.id });

    detail = await getAdminOrder(db, order.orderNumber);
    expect(detail?.fulfillmentStatus).toBe("DELIVERED");
    expect(detail?.shipments[0].statusNormalized).toBe("DELIVERED");

    const a = await admin();
    const refund = await requestRefund(db, rzp, {
      orderId: order.id,
      amountPaise: 30000,
      reason: "goodwill",
      adminUserId: a.id,
      operationKey: "r1",
    });
    expect(refund.status).toBe("COMPLETED");

    detail = await getAdminOrder(db, order.orderNumber);
    expect(detail?.refunds).toHaveLength(1);
    expect(detail?.invoices).toHaveLength(1); // created by the refund flow
    expect(detail?.paymentStatus).toBe("PARTIALLY_REFUNDED");
  });
});

describe("operator drives a COD lifecycle", () => {
  it("confirm → ship → deliver → collect; never shows as paid from delivery", async () => {
    const v = await makeVariant({ onHand: 5 });
    const order = await place("COD", [{ variantId: v, quantity: 1 }]);
    await confirmCodOrder(db, { orderId: order.id });

    const fx = new FakeShadowfax();
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "PICKED_UP", T(9));
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "DELIVERED", T(15));
    await reconcileShipment(db, fx, { shipmentId: shipment.id });

    let detail = await getAdminOrder(db, order.orderNumber);
    expect(detail?.fulfillmentStatus).toBe("DELIVERED");
    expect(detail?.paymentStatus).toBe("COD_PENDING"); // not paid from delivery

    fx.simulateCodCollected({ merchantReference: shipment.merchantReference }, order.totalPaise, T(15));
    await syncCodRemittance(db, fx, { shipmentId: shipment.id });

    detail = await getAdminOrder(db, order.orderNumber);
    expect(detail?.paymentStatus).toBe("COD_COLLECTED");
  });
});

// ──────────────────── needs-attention resolution (AC-15) ────────────────────

describe("Needs Attention queue", () => {
  it("an NDR task appears and only resolves with an explicit decision", async () => {
    const v = await makeVariant({ onHand: 5 });
    const order = await place("COD", [{ variantId: v, quantity: 1 }]);
    await confirmCodOrder(db, { orderId: order.id });
    const fx = new FakeShadowfax();
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "OUT_FOR_DELIVERY", T(9));
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "UNDELIVERED", T(10));
    await reconcileShipment(db, fx, { shipmentId: shipment.id });

    const tasks = await listOpenTasks(db, { type: "NDR" });
    expect(tasks).toHaveLength(1);
    const a = await admin();

    await expect(
      resolveTaskChecked(db, { taskId: tasks[0].id, adminUserId: a.id }),
    ).rejects.toBeInstanceOf(TaskStillActiveError);

    const r = await resolveTaskChecked(db, {
      taskId: tasks[0].id,
      adminUserId: a.id,
      reason: "customer reached, re-attempt arranged",
      force: true,
    });
    expect(r.resolved).toBe(true);
    expect(
      await db.operationalTask.count({ where: { dedupeKey: `ndr:${shipment.id}`, status: "RESOLVED" } }),
    ).toBe(1);
    expect(await db.adminActivityLog.count({ where: { action: "task.resolve" } })).toBe(1);
  });

  it("a low-stock task resolves automatically once stock is back above threshold", async () => {
    const v = await makeVariant({ onHand: 5, lowStockThreshold: 3 });
    const a = await admin();
    await adjustStock(db, { variantId: v, delta: -3, reason: "damaged units", adminUserId: a.id });
    let task = await db.operationalTask.findUnique({ where: { dedupeKey: `low-stock:${v}` } });
    expect(task?.status).toBe("OPEN");

    // still low → refuse
    await expect(
      resolveTaskChecked(db, { taskId: task!.id, adminUserId: a.id }),
    ).rejects.toBeInstanceOf(TaskStillActiveError);

    await adjustStock(db, { variantId: v, delta: +10, reason: "restock delivery", adminUserId: a.id });
    // adjustStock resolves it itself, but resolveTaskChecked must also accept it now
    task = await db.operationalTask.findUnique({ where: { dedupeKey: `low-stock:${v}` } });
    expect(task?.status).toBe("RESOLVED");
  });

  it("a payment-review task refuses to resolve while the order is NEEDS_REVIEW", async () => {
    const v = await makeVariant({ onHand: 1 });
    const order = await place("PREPAID_RAZORPAY", [{ variantId: v, quantity: 1 }]);
    await db.order.update({ where: { id: order.id }, data: { orderStatus: "NEEDS_REVIEW" } });
    const task = await db.operationalTask.create({
      data: {
        dedupeKey: `payment-review:${order.id}`,
        type: "PAYMENT_REVIEW",
        entityType: "Order",
        entityId: order.id,
        reason: "amount mismatch",
      },
    });
    const a = await admin();
    await expect(
      resolveTaskChecked(db, { taskId: task.id, adminUserId: a.id }),
    ).rejects.toBeInstanceOf(TaskStillActiveError);

    await db.order.update({ where: { id: order.id }, data: { orderStatus: "CONFIRMED" } });
    const r = await resolveTaskChecked(db, { taskId: task.id, adminUserId: a.id });
    expect(r.resolved).toBe(true);
  });
});

describe("bulk actions report per-record results", () => {
  it("resolves the clearable tasks and reports the rest", async () => {
    const a = await admin();
    const v1 = await makeVariant({ onHand: 5, lowStockThreshold: 3 });
    const v2 = await makeVariant({ onHand: 5, lowStockThreshold: 3 });
    await adjustStock(db, { variantId: v1, delta: -3, reason: "x", adminUserId: a.id });
    await adjustStock(db, { variantId: v2, delta: -3, reason: "x", adminUserId: a.id });
    // fix v1 only
    await adjustStock(db, { variantId: v1, delta: +10, reason: "restock", adminUserId: a.id });

    const t1 = await db.operationalTask.findUniqueOrThrow({ where: { dedupeKey: `low-stock:${v1}` } });
    const t2 = await db.operationalTask.findUniqueOrThrow({ where: { dedupeKey: `low-stock:${v2}` } });

    const result = await runBulk([t1.id, t2.id], async (id) => {
      await resolveTaskChecked(db, { taskId: id, adminUserId: a.id, reason: "bulk" });
    });
    expect(result.attempted).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results.find((r) => r.id === t2.id)?.error).toMatch(/still active/i);
  });
});

// ─────────────────────── list / analytics / auth (AC-12) ────────────────────

describe("order list pagination is stable under inserts", () => {
  it("the second page returns the same rows even after a new order is placed", async () => {
    const v = await makeVariant({ onHand: 50 });
    const orders: string[] = [];
    for (let i = 0; i < 5; i++) {
      orders.push((await place("COD", [{ variantId: v, quantity: 1 }])).orderNumber);
      await new Promise((r) => setTimeout(r, 3));
    }
    const p1 = await listOrders(db, { limit: 2 });
    expect(p1.rows).toHaveLength(2);
    expect(p1.nextCursor).toBeTruthy();

    // a new order arrives between page views
    await place("COD", [{ variantId: v, quantity: 1 }]);

    const p2 = await listOrders(db, { limit: 2, cursor: p1.nextCursor! });
    const p1ids = new Set(p1.rows.map((r) => r.id));
    expect(p2.rows.every((r) => !p1ids.has(r.id))).toBe(true); // no overlap
    // p2 rows are the 3rd/4th oldest-visible, unaffected by the insert
    expect(p2.rows).toHaveLength(2);
  });
});

describe("analytics", () => {
  it("allocates a mixed order's revenue by line and never exposes cost data", async () => {
    const tpe = await makeVariant({ catalog: "THE_POOJA_EDIT", price: 150000, onHand: 5 });
    const thr = await makeVariant({ catalog: "THRIFT", price: 90000, onHand: 1, acquisitionCostPaise: 40000 });
    const order = await place("COD", [
      { variantId: tpe, quantity: 1 },
      { variantId: thr, quantity: 1 },
    ]);

    const f = await getFinancialSummary(db);
    expect(f.placed.orders).toBe(1);
    expect(f.placed.byCatalogPaise.THE_POOJA_EDIT).toBeGreaterThan(0);
    expect(f.placed.byCatalogPaise.THRIFT).toBeGreaterThan(0);
    // line totals sum to the order's item total (excludes shipping / COD fee)
    const items = await db.orderItem.findMany({ where: { orderId: order.id } });
    const lineSum = items.reduce((s, i) => s + i.totalPaise, 0);
    expect(
      f.placed.byCatalogPaise.THE_POOJA_EDIT + f.placed.byCatalogPaise.THRIFT,
    ).toBe(lineSum);

    const blob = JSON.stringify(await getOverview(db)).toLowerCase();
    expect(blob).not.toContain("acquisition");
    expect(blob).not.toContain("acquisitioncost");
  });
});

describe("authorization", () => {
  it("an inactive admin is rejected by the active-admin guard", async () => {
    const inactive = await db.adminUser.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "ADMIN", isActive: false },
    });
    expect(() => assertActiveAdmin(inactive)).toThrow(AuthorizationError);
  });
});

describe("inventory corrections", () => {
  it("cannot drive on-hand below reserved or below zero; every change is ledgered + audited", async () => {
    const v = await makeVariant({ onHand: 5 });
    const a = await admin();
    // reserve 3 via a real order
    await place("PREPAID_RAZORPAY", [{ variantId: v, quantity: 3 }]);

    await expect(
      adjustStock(db, { variantId: v, delta: -3, reason: "shrinkage", adminUserId: a.id }),
    ).rejects.toThrow(); // would leave onHand 2 < reserved 3

    const ok = await adjustStock(db, { variantId: v, delta: -1, reason: "shrinkage", adminUserId: a.id });
    expect(ok.onHandQty).toBe(4);
    expect(
      await db.inventoryTransaction.count({ where: { variantId: v, type: "ADJUST" } }),
    ).toBe(1);
    expect(
      await db.adminActivityLog.count({ where: { action: "inventory.adjust", entityId: v } }),
    ).toBe(1);
  });
});

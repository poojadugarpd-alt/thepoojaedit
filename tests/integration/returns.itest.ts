import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { placeOrder, type AddressInput } from "../../src/server/checkout/place-order";
import { RefundLimitError } from "../../src/server/payments/port";
import {
  createPaymentAttempt,
  verifyPrepaidCheckout,
} from "../../src/server/payments/service";
import { FakeRazorpay } from "../../src/server/payments/testing";
import {
  makeRefundReconcilePort,
  requestRefund,
} from "../../src/server/refunds/service";
import {
  createReturnRequest,
  decideReturn,
  finalizeReturnInspection,
  inspectReturnItem,
  markReturnReceived,
  resolveReturn,
} from "../../src/server/returns/service";
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
async function makeVariant(onHand = 10, pricePaise = 100000) {
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
    data: { productId: p.id, sku: `SKU-${randomUUID().slice(0, 8)}`, pricePaise, onHandQty: onHand },
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

/** A prepaid order, captured & CONFIRMED, delivered. Returns { order, rzp }. */
async function deliveredPaidOrder(variantId: string, quantity = 2) {
  const { order } = await placeOrder(db, {
    idempotencyKey: randomUUID(),
    scope: `guest:${randomUUID().slice(0, 12)}`,
    contact: { phone: "+919999900000", email: "buyer@example.invalid" },
    lines: [{ variantId, quantity }],
    paymentMethod: "PREPAID_RAZORPAY",
    billing: addr(),
    shipping: addr(),
  });
  const rzp = new FakeRazorpay();
  const attempt = await createPaymentAttempt(db, rzp, { orderId: order.id });
  const pay = rzp.simulateCaptured(attempt.providerOrderId!);
  await verifyPrepaidCheckout(db, rzp, {
    providerOrderId: attempt.providerOrderId!,
    providerPaymentId: pay.providerPaymentId,
    signature: rzp.signCheckout(attempt.providerOrderId!, pay.providerPaymentId),
  });
  await db.order.update({
    where: { id: order.id },
    data: { fulfillmentStatus: "DELIVERED" },
  });
  return { order: await db.order.findUniqueOrThrow({ where: { id: order.id } }), rzp };
}

const admin = () =>
  db.adminUser.create({
    data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
  });

describe("refund workflow (AC-05/07/11)", () => {
  it("partial refunds sum correctly and never exceed the captured amount", async () => {
    const v = await makeVariant();
    const { order, rzp } = await deliveredPaidOrder(v, 2);
    const a = await admin();
    const total = order.totalPaise;

    const r1 = await requestRefund(db, rzp, {
      orderId: order.id,
      amountPaise: Math.floor(total * 0.4),
      reason: "partial 1",
      adminUserId: a.id,
      operationKey: "p1",
    });
    const r2 = await requestRefund(db, rzp, {
      orderId: order.id,
      amountPaise: Math.floor(total * 0.4),
      reason: "partial 2",
      adminUserId: a.id,
      operationKey: "p2",
    });
    expect(r1.status).toBe("COMPLETED");
    expect(r2.status).toBe("COMPLETED");

    await expect(
      requestRefund(db, rzp, {
        orderId: order.id,
        amountPaise: Math.floor(total * 0.4),
        reason: "over",
        adminUserId: a.id,
        operationKey: "p3",
      }),
    ).rejects.toBeInstanceOf(RefundLimitError);

    const refunds = await db.refund.findMany({ where: { orderId: order.id } });
    const sum = refunds
      .filter((r) => r.status !== "FAILED")
      .reduce((s, r) => s + r.amountPaise, 0);
    expect(sum).toBeLessThanOrEqual(total);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus,
    ).toBe("PARTIALLY_REFUNDED");
  });

  it("a completed refund issues a credit note against the invoice and emits refund.completed", async () => {
    const v = await makeVariant();
    const { order, rzp } = await deliveredPaidOrder(v, 1);
    const a = await admin();

    await requestRefund(db, rzp, {
      orderId: order.id,
      amountPaise: order.totalPaise,
      reason: "full",
      adminUserId: a.id,
      operationKey: "full",
    });

    const invoice = await db.invoice.findUniqueOrThrow({ where: { orderId: order.id } });
    const cn = await db.creditNote.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    expect(cn.reason).toBe("REFUND");
    expect(
      await db.domainEvent.count({
        where: { type: "refund.completed", aggregateId: order.id },
      }),
    ).toBe(1);
    // refund completion must NOT restock
    expect(
      await db.inventoryTransaction.count({
        where: { type: { in: ["RETURN_RESTOCK", "RTO_RESTOCK"] } },
      }),
    ).toBe(0);
  });

  it("reconciles a refund whose completion callback was missed", async () => {
    const v = await makeVariant();
    const { order, rzp } = await deliveredPaidOrder(v, 1);
    const a = await admin();
    // request, then force the row back to PROCESSING with an old updatedAt
    const refund = await requestRefund(db, rzp, {
      orderId: order.id,
      amountPaise: 20000,
      reason: "x",
      adminUserId: a.id,
      operationKey: "recon",
    });
    await db.refund.update({
      where: { id: refund.id },
      data: { status: "PROCESSING", updatedAt: new Date(Date.now() - 60 * 60_000) },
    });

    const port = makeRefundReconcilePort(db, rzp, { staleAfterMs: 60_000 });
    const summary = await port.reconcilePending(new Date());
    expect(summary.updated).toBe(1);
    expect(
      (await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status,
    ).toBe("COMPLETED");
  });
});

describe("returns lifecycle (AC-05/09)", () => {
  it("request → approve → receive → inspect RESTOCK restocks once; duplicate inspection does not", async () => {
    const v = await makeVariant(4);
    const { order } = await deliveredPaidOrder(v, 2); // on-hand 4 → 2 (converted)
    const a = await admin();
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });

    const rr = await createReturnRequest(db, {
      orderId: order.id,
      reason: "size",
      items: [{ orderItemId: item.id, quantity: 2 }],
    });
    await decideReturn(db, { returnRequestId: rr.id, approve: true, adminUserId: a.id });
    await markReturnReceived(db, { returnRequestId: rr.id, adminUserId: a.id });

    const ri = await db.returnItem.findFirstOrThrow({ where: { returnRequestId: rr.id } });
    const first = await inspectReturnItem(db, {
      returnItemId: ri.id,
      outcome: "RESTOCK",
      conditionNotes: "unworn",
      adminUserId: a.id,
    });
    expect(first.restocked).toBe(true);
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(4);

    const second = await inspectReturnItem(db, {
      returnItemId: ri.id,
      outcome: "RESTOCK",
      adminUserId: a.id,
    });
    expect(second.restocked).toBe(false);
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(4);
    expect(
      await db.inventoryTransaction.count({ where: { type: "RETURN_RESTOCK" } }),
    ).toBe(1);
  });

  it("a DAMAGED_DISCARD inspection does not restock", async () => {
    const v = await makeVariant(4);
    const { order } = await deliveredPaidOrder(v, 1);
    const a = await admin();
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const rr = await createReturnRequest(db, {
      orderId: order.id,
      reason: "faulty",
      items: [{ orderItemId: item.id, quantity: 1 }],
    });
    await decideReturn(db, { returnRequestId: rr.id, approve: true, adminUserId: a.id });
    await markReturnReceived(db, { returnRequestId: rr.id, adminUserId: a.id });
    const ri = await db.returnItem.findFirstOrThrow({ where: { returnRequestId: rr.id } });
    const r = await inspectReturnItem(db, {
      returnItemId: ri.id,
      outcome: "DAMAGED_DISCARD",
      adminUserId: a.id,
    });
    expect(r.restocked).toBe(false);
    expect(await db.inventoryTransaction.count({ where: { type: "RETURN_RESTOCK" } })).toBe(0);
  });

  it("resolving a return as REFUND creates a refund for the line value", async () => {
    const v = await makeVariant(4, 100000);
    const { order, rzp } = await deliveredPaidOrder(v, 2);
    const a = await admin();
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const rr = await createReturnRequest(db, {
      orderId: order.id,
      reason: "changed mind",
      items: [{ orderItemId: item.id, quantity: 1 }],
    });
    await decideReturn(db, { returnRequestId: rr.id, approve: true, adminUserId: a.id });
    await markReturnReceived(db, { returnRequestId: rr.id, adminUserId: a.id });
    const ri = await db.returnItem.findFirstOrThrow({ where: { returnRequestId: rr.id } });
    await inspectReturnItem(db, { returnItemId: ri.id, outcome: "RESTOCK", adminUserId: a.id });
    await finalizeReturnInspection(db, { returnRequestId: rr.id, adminUserId: a.id });

    const resolved = await resolveReturn(db, rzp, {
      returnRequestId: rr.id,
      resolution: "REFUND",
      adminUserId: a.id,
    });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolution).toBe("REFUND");

    const refund = await db.refund.findFirstOrThrow({
      where: { orderId: order.id, operationKey: `return-refund:${rr.id}` },
    });
    // one of two units → half the line total (incl. tax)
    expect(refund.amountPaise).toBe(Math.round(item.totalPaise / 2));
    const cn = await db.creditNote.findFirstOrThrow({ where: { refundId: refund.id } });
    expect(cn.reason).toBe("RETURN");
  });

  it("a final-sale (thrift) line cannot be returned", async () => {
    // one-of-one thrift piece: returnPolicySnapshot.finalSale = true
    const p = await db.product.create({
      data: {
        catalog: "THRIFT",
        slug: `t-${randomUUID().slice(0, 8)}`,
        title: "Thrift piece",
        status: "PUBLISHED",
        publishedAt: new Date(),
        thriftDetails: { create: { conditionGrade: "GOOD", measurements: {}, isOneOfOne: true } },
      },
    });
    const variant = await db.productVariant.create({
      data: { productId: p.id, sku: `T-${randomUUID().slice(0, 8)}`, pricePaise: 50000, onHandQty: 1 },
    });
    const { order } = await deliveredPaidOrder(variant.id, 1);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    await expect(
      createReturnRequest(db, {
        orderId: order.id,
        reason: "no",
        items: [{ orderItemId: item.id, quantity: 1 }],
      }),
    ).rejects.toThrow(/final sale/i);
  });
});

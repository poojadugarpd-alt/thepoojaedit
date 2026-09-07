import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { placeOrder, type AddressInput } from "../../src/server/checkout/place-order";
import { computeQuote, QuoteError } from "../../src/server/checkout/quote";
import { confirmCodOrder } from "../../src/server/orders/lifecycle";
import { ShippingError } from "../../src/server/shipping/port";
import {
  applyTrackingEvent,
  createShipmentForOrder,
  ensureShipmentForConfirmedOrder,
  getShipmentLabel,
  handleShadowfaxWebhook,
  inspectRtoReturn,
  reconcileShipment,
  syncCodRemittance,
} from "../../src/server/shipping/service";
import { FAKE_WEBHOOK_TOKEN, FakeShadowfax } from "../../src/server/shipping/testing";
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
async function makeVariant(onHand: number, pricePaise = 149900) {
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
      pricePaise,
      onHandQty: onHand,
      weightGrams: 350,
    },
  });
  return v.id;
}

const addr = (postcode = "302001"): AddressInput => ({
  name: "Buyer",
  phone: "+919999900000",
  line1: "1 St",
  city: "Jaipur",
  stateName: "Rajasthan",
  stateCode: "08",
  postcode,
});

async function placeConfirmedCod(
  fx: FakeShadowfax,
  variantId: string,
  quantity = 1,
  postcode = "302001",
) {
  const { order } = await placeOrder(db, {
    idempotencyKey: randomUUID(),
    scope: `guest:${randomUUID().slice(0, 12)}`,
    contact: { phone: "+919999900000" },
    lines: [{ variantId, quantity }],
    paymentMethod: "COD",
    billing: addr(postcode),
    shipping: addr(postcode),
    shippingPort: fx,
  });
  await confirmCodOrder(db, { orderId: order.id });
  return db.order.findUniqueOrThrow({ where: { id: order.id } });
}

const T = (h: number) => new Date(Date.UTC(2026, 0, 2, h, 0, 0));

// ─────────────────────────── serviceability / rate ──────────────────────────

describe("checkout serviceability (AC-09)", () => {
  it("a non-serviceable PIN code blocks the quote", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    await expect(
      computeQuote(db, {
        lines: [{ variantId: v, quantity: 1 }],
        paymentMethod: "PREPAID_RAZORPAY",
        destination: { stateCode: "08", postcode: "000000" },
        shipping: fx,
      }),
    ).rejects.toBeInstanceOf(QuoteError);
  });

  it("COD disallowed for a PIN code blocks a COD quote", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    await expect(
      computeQuote(db, {
        lines: [{ variantId: v, quantity: 1 }],
        paymentMethod: "COD",
        destination: { stateCode: "08", postcode: "560100" },
        shipping: fx,
      }),
    ).rejects.toBeInstanceOf(QuoteError);
  });
});

// ─────────────────────────── shipment creation ──────────────────────────────

describe("shipment creation is safe across retries (AC-13)", () => {
  it("a provider timeout BEFORE creation is recovered by reusing the claimed row", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v);

    fx.failNextCreateBeforeRecord = true;
    await expect(
      createShipmentForOrder(db, fx, { orderId: order.id }),
    ).rejects.toBeInstanceOf(ShippingError);

    const rows1 = await db.shipment.findMany({ where: { orderId: order.id } });
    expect(rows1).toHaveLength(1);
    expect(rows1[0].providerShipmentId).toBeNull();
    expect(
      await db.operationalTask.count({
        where: { dedupeKey: `shipment-failure:${order.id}`, status: "OPEN" },
      }),
    ).toBe(1);

    const r = await createShipmentForOrder(db, fx, { orderId: order.id });
    expect(r.shipment.id).toBe(rows1[0].id);
    expect(r.shipment.providerShipmentId).not.toBeNull();
    expect(await db.shipment.count({ where: { orderId: order.id } })).toBe(1);
    expect(fx.shipments.size).toBe(1);
    expect(
      await db.operationalTask.count({
        where: { dedupeKey: `shipment-failure:${order.id}`, status: "OPEN" },
      }),
    ).toBe(0);
  });

  it("a provider timeout AFTER creation adopts the existing shipment, no duplicate", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v);

    fx.failNextCreateAfterRecord = true;
    await expect(
      createShipmentForOrder(db, fx, { orderId: order.id }),
    ).rejects.toBeInstanceOf(ShippingError);
    expect(fx.shipments.size).toBe(1); // provider recorded it before throwing

    const r = await createShipmentForOrder(db, fx, { orderId: order.id });
    expect(r.shipment.providerShipmentId).not.toBeNull();
    expect(r.shipment.awb).not.toBeNull();
    expect(await db.shipment.count({ where: { orderId: order.id } })).toBe(1);
    expect(fx.shipments.size).toBe(1);
  });

  it("a repeated create request does not create a second shipment", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v, 2);

    const a = await createShipmentForOrder(db, fx, { orderId: order.id });
    const b = await createShipmentForOrder(db, fx, { orderId: order.id });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.shipment.id).toBe(a.shipment.id);
    expect(await db.shipment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db.shipmentItem.count({ where: { shipmentId: a.shipment.id } })).toBe(1);
    expect(fx.shipments.size).toBe(1);
    // order fulfilment moved to PROCESSING
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).fulfillmentStatus,
    ).toBe("PROCESSING");
  });

  it("ensureShipmentForConfirmedOrder auto-creates for a CONFIRMED order only", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const { order } = await placeOrder(db, {
      idempotencyKey: randomUUID(),
      scope: `guest:${randomUUID().slice(0, 12)}`,
      contact: { phone: "+919999900000" },
      lines: [{ variantId: v, quantity: 1 }],
      paymentMethod: "COD",
      billing: addr(),
      shipping: addr(),
      shippingPort: fx,
    });
    // not confirmed yet
    const skipped = await ensureShipmentForConfirmedOrder(db, fx, { orderId: order.id });
    expect(skipped.created).toBe(false);

    await confirmCodOrder(db, { orderId: order.id });
    const made = await ensureShipmentForConfirmedOrder(db, fx, { orderId: order.id });
    expect(made.created).toBe(true);
    const again = await ensureShipmentForConfirmedOrder(db, fx, { orderId: order.id });
    expect(again.created).toBe(false);
  });
});

// ─────────────────────────── tracking + callbacks ───────────────────────────

describe("tracking normalization (AC-13)", () => {
  it("an out-of-order scan is recorded but never regresses status", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v);
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });

    fx.simulateScan({ merchantReference: shipment.merchantReference }, "PICKED_UP", T(9));
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "OUT_FOR_DELIVERY", T(13));
    await reconcileShipment(db, fx, { shipmentId: shipment.id });
    expect(
      (await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } }))
        .statusNormalized,
    ).toBe("OUT_FOR_DELIVERY");

    // a late "in transit" scan from 11:00 arrives afterwards
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "IN_TRANSIT", T(11));
    await reconcileShipment(db, fx, { shipmentId: shipment.id });

    const s = await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
    expect(s.statusNormalized).toBe("OUT_FOR_DELIVERY"); // not regressed to SHIPPED
    expect(
      await db.shipmentEvent.count({
        where: { shipmentId: shipment.id, statusRaw: "IN_TRANSIT" },
      }),
    ).toBe(1); // still recorded for audit
  });

  it("repeated NDR events keep ONE task and bump the attempt count", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v);
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });

    fx.simulateScan({ merchantReference: shipment.merchantReference }, "OUT_FOR_DELIVERY", T(9));
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "UNDELIVERED", T(10));
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "OUT_FOR_DELIVERY", T(11));
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "UNDELIVERED", T(12));
    await reconcileShipment(db, fx, { shipmentId: shipment.id });

    const tasks = await db.operationalTask.findMany({
      where: { dedupeKey: `ndr:${shipment.id}` },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("OPEN");
    expect(tasks[0].reason).toMatch(/attempt 2/);
    expect(
      await db.shipmentEvent.count({
        where: { shipmentId: shipment.id, statusNormalized: "NDR" },
      }),
    ).toBe(2);
  });

  it("a bad callback token is rejected 401 with nothing persisted; a good one is 200", async () => {
    const fx = new FakeShadowfax();
    fx.webhookToken = FAKE_WEBHOOK_TOKEN;
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v);
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "PICKED_UP", T(9));

    const bad = fx.buildWebhook(
      { merchantReference: shipment.merchantReference },
      "PICKED_UP",
      T(9),
    );
    const rBad = await handleShadowfaxWebhook(db, fx, bad);
    expect(rBad.httpStatus).toBe(401);
    expect(await db.webhookEvent.count()).toBe(0);

    const good = fx.buildWebhook(
      { merchantReference: shipment.merchantReference },
      "PICKED_UP",
      T(9),
      { token: FAKE_WEBHOOK_TOKEN },
    );
    const rGood = await handleShadowfaxWebhook(db, fx, good);
    expect(rGood.httpStatus).toBe(200);
    expect(await db.webhookEvent.count()).toBe(1);
    // re-verified via API → status advanced from the fake's scans
    expect(
      (await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } }))
        .statusNormalized,
    ).toBe("SHIPPED");

    // redelivery of identical bytes → deduped
    const rDup = await handleShadowfaxWebhook(db, fx, good);
    expect(rDup.body).toMatchObject({ deduplicated: true });
    expect(await db.webhookEvent.count()).toBe(1);
  });
});

// ─────────────────────────────── RTO + restock ─────────────────────────────

describe("RTO handling (AC-05/09/13)", () => {
  it("RTO-in-transit does not restock; inspected RTO restocks exactly once", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(4);
    const order = await placeConfirmedCod(fx, v, 2); // committed COD stock: onHand 4 → 2
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });

    fx.simulateScan({ merchantReference: shipment.merchantReference }, "OUT_FOR_DELIVERY", T(9));
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "RTO_INITIATED", T(10));
    await reconcileShipment(db, fx, { shipmentId: shipment.id });

    expect(
      (await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } }))
        .statusNormalized,
    ).toBe("RTO_IN_TRANSIT");
    expect(
      await db.inventoryTransaction.count({ where: { type: "RTO_RESTOCK" } }),
    ).toBe(0);
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(2); // unchanged — no restock from in-transit

    // parcel received back
    fx.simulateScan({ merchantReference: shipment.merchantReference }, "RTO_DELIVERED", T(11));
    await reconcileShipment(db, fx, { shipmentId: shipment.id });
    expect(
      (await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } }))
        .statusNormalized,
    ).toBe("RTO_RECEIVED");
    expect(
      await db.operationalTask.count({
        where: { dedupeKey: `rto-inspection:${shipment.id}`, status: "OPEN" },
      }),
    ).toBe(1);

    const admin = await db.adminUser.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
    });
    const r1 = await inspectRtoReturn(db, {
      shipmentId: shipment.id,
      adminUserId: admin.id,
      outcome: "RESTOCK",
      reason: "sealed, resellable",
    });
    expect(r1.restockedVariants).toBe(1);
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(4); // restored
    expect(
      await db.operationalTask.count({
        where: { dedupeKey: `rto-inspection:${shipment.id}`, status: "RESOLVED" },
      }),
    ).toBe(1);
    expect(
      await db.adminActivityLog.count({
        where: { action: "shipment.rto_inspected", entityId: shipment.id },
      }),
    ).toBe(1);

    // a duplicate inspection restocks nothing
    const r2 = await inspectRtoReturn(db, {
      shipmentId: shipment.id,
      adminUserId: admin.id,
      outcome: "RESTOCK",
      reason: "again",
    });
    expect(r2.restockedVariants).toBe(0);
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(4);
    expect(
      await db.inventoryTransaction.count({ where: { type: "RTO_RESTOCK" } }),
    ).toBe(1);
  });
});

// ─────────────────────────────── COD money flow ────────────────────────────

describe("COD collection vs remittance (AC-09)", () => {
  it("delivery does not mark COD paid; collection sets COD_COLLECTED; remittance is separate", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v);
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });
    const expected = order.totalPaise;

    fx.simulateScan({ merchantReference: shipment.merchantReference }, "DELIVERED", T(12));
    await reconcileShipment(db, fx, { shipmentId: shipment.id });

    let o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.fulfillmentStatus).toBe("DELIVERED");
    expect(o.paymentStatus).toBe("COD_PENDING"); // NOT paid from delivery alone

    fx.simulateCodCollected({ merchantReference: shipment.merchantReference }, expected, T(12));
    const s1 = await syncCodRemittance(db, fx, { shipmentId: shipment.id });
    expect(s1?.status).toBe("COLLECTED");
    o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("COD_COLLECTED");
    let rem = await db.codRemittance.findFirstOrThrow({ where: { shipmentId: shipment.id } });
    expect(rem.collectedPaise).toBe(expected);
    expect(rem.remittedPaise).toBeNull();

    fx.simulateCodRemitted(
      { merchantReference: shipment.merchantReference },
      expected,
      "UTR-8899",
      T(48),
    );
    const s2 = await syncCodRemittance(db, fx, { shipmentId: shipment.id });
    expect(s2?.status).toBe("REMITTED");
    rem = await db.codRemittance.findFirstOrThrow({ where: { shipmentId: shipment.id } });
    expect(rem.remittedPaise).toBe(expected);
    expect(rem.providerReference).toBe("UTR-8899");
    expect(rem.collectedAt?.getTime()).not.toBe(rem.remittedAt?.getTime());
    // remittance does not change the order's payment status
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus,
    ).toBe("COD_COLLECTED");
  });

  it("a short COD collection is flagged as a discrepancy", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v);
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });

    fx.simulateCodCollected(
      { merchantReference: shipment.merchantReference },
      order.totalPaise - 1000,
      T(12),
    );
    const s = await syncCodRemittance(db, fx, { shipmentId: shipment.id });
    expect(s?.status).toBe("DISPUTED");
    expect(
      await db.operationalTask.count({
        where: { dedupeKey: `cod-remittance:${order.id}`, status: "OPEN" },
      }),
    ).toBe(1);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus,
    ).toBe("COD_PENDING");
  });
});

// ─────────────────────────────── label access ─────────────────────────────

describe("label access", () => {
  it("returns label bytes for a shipment with an AWB", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v);
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });
    const label = await getShipmentLabel(db, fx, { shipmentId: shipment.id });
    expect(label.contentType).toBe("application/pdf");
    expect(label.bytes.length).toBeGreaterThan(0);
  });

  it("throws before an AWB exists", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v);
    const s = await db.shipment.create({
      data: {
        orderId: order.id,
        provider: "shadowfax",
        merchantReference: `SHP-NOAWB-${randomUUID().slice(0, 8)}`,
        statusNormalized: "PENDING",
      },
    });
    await expect(
      getShipmentLabel(db, fx, { shipmentId: s.id }),
    ).rejects.toBeInstanceOf(ShippingError);
  });
});

// ───────────────────────────── forward progression ────────────────────────

describe("forward tracking progression", () => {
  it("PICKED_UP → OUT_FOR_DELIVERY → DELIVERED advances shipment and order", async () => {
    const fx = new FakeShadowfax();
    const v = await makeVariant(5);
    const order = await placeConfirmedCod(fx, v);
    const { shipment } = await createShipmentForOrder(db, fx, { orderId: order.id });

    for (const [status, h] of [
      ["PICKED_UP", 9],
      ["OUT_FOR_DELIVERY", 12],
      ["DELIVERED", 14],
    ] as const) {
      await applyTrackingEvent(db, {
        shipmentId: shipment.id,
        statusRaw: status,
        occurredAt: T(h),
        source: "test",
      });
    }
    const s = await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
    expect(s.statusNormalized).toBe("DELIVERED");
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).fulfillmentStatus,
    ).toBe("DELIVERED");
  });
});

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import {
  IdempotencyConflictError,
  PriceChangedError,
  placeOrder,
  type AddressInput,
} from "../../src/server/checkout/place-order";
import { computeQuote } from "../../src/server/checkout/quote";
import {
  cancelOrder,
  confirmCodOrder,
  settleCapturedPayment,
} from "../../src/server/orders/lifecycle";
import { expireReservations } from "../../src/server/inventory/reservations";
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
    data: {
      key: "checkout.rules",
      value: { reservationTtlSeconds: 600, codFeePaise: 3000 },
    },
  });
});

let seq = 0;
async function makeVariant(opts: {
  onHand: number;
  pricePaise?: number;
  oneOfOne?: boolean;
}) {
  const isThrift = opts.oneOfOne ?? false;
  const p = await db.product.create({
    data: {
      catalog: isThrift ? "THRIFT" : "THE_POOJA_EDIT",
      slug: `p-${++seq}-${randomUUID().slice(0, 6)}`,
      title: `P${seq}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      taxClass: {
        create: {
          code: `TC-${randomUUID().slice(0, 8)}`,
          name: "Standard test",
          treatment: "STANDARD",
          rules: {
            create: {
              pricingMode: "INCLUSIVE",
              totalRateBps: 500,
              cgstRateBps: 250,
              sgstRateBps: 250,
              igstRateBps: 500,
              effectiveFrom: new Date("2026-01-01"),
            },
          },
        },
      },
      ...(isThrift
        ? {
            thriftDetails: {
              create: {
                conditionGrade: "GOOD",
                measurements: { bust: { value: "34" } },
                isOneOfOne: true,
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
      pricePaise: opts.pricePaise ?? 149900,
      onHandQty: opts.onHand,
    },
  });
  return v.id;
}

const addr = (stateCode = "08"): AddressInput => ({
  name: "Buyer",
  phone: "+919999900000",
  line1: "1 St",
  city: "Jaipur",
  stateName: stateCode === "08" ? "Rajasthan" : "Maharashtra",
  stateCode,
  postcode: "302001",
});

function baseInput(overrides: Partial<Parameters<typeof placeOrder>[1]> = {}) {
  return {
    idempotencyKey: randomUUID(),
    scope: `guest:${randomUUID().slice(0, 12)}`,
    contact: { phone: "+919999900000", email: "g@example.invalid" },
    lines: [],
    paymentMethod: "PREPAID_RAZORPAY" as const,
    billing: addr(),
    shipping: addr(),
    ...overrides,
  };
}

describe("idempotent checkout (AC-07)", () => {
  it("a duplicate checkout with the same key + items returns the same order", async () => {
    const variantId = await makeVariant({ onHand: 5 });
    const input = baseInput({ lines: [{ variantId, quantity: 2 }] });

    const first = await placeOrder(db, input);
    const second = await placeOrder(db, input);

    expect(second.alreadyExisted).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(await db.order.count()).toBe(1);
    expect(await db.inventoryReservation.count({ where: { status: "ACTIVE" } })).toBe(
      1,
    );
  });

  it("the same key with different items is a conflict, not a second order", async () => {
    const a = await makeVariant({ onHand: 5 });
    const b = await makeVariant({ onHand: 5 });
    const key = randomUUID();
    const scope = `guest:${randomUUID().slice(0, 12)}`;

    await placeOrder(
      db,
      baseInput({ idempotencyKey: key, scope, lines: [{ variantId: a, quantity: 1 }] }),
    );
    await expect(
      placeOrder(
        db,
        baseInput({
          idempotencyKey: key,
          scope,
          lines: [{ variantId: b, quantity: 1 }],
        }),
      ),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(await db.order.count()).toBe(1);
  });
});

describe("server-authoritative pricing (AC-06/11)", () => {
  it("uses the server quote; a stale quote hash is rejected (price changed)", async () => {
    const variantId = await makeVariant({ onHand: 5, pricePaise: 100000 });
    const quote = await computeQuote(db, {
      lines: [{ variantId, quantity: 1 }],
      paymentMethod: "PREPAID_RAZORPAY",
      destination: { stateCode: "08", postcode: "302001" },
    });

    await db.productVariant.update({
      where: { id: variantId },
      data: { pricePaise: 120000 },
    });

    await expect(
      placeOrder(
        db,
        baseInput({ lines: [{ variantId, quantity: 1 }], clientQuoteHash: quote.hash }),
      ),
    ).rejects.toBeInstanceOf(PriceChangedError);
    expect(await db.order.count()).toBe(0);
  });

  it("order totals reconcile in paise and satisfy the DB identity", async () => {
    const a = await makeVariant({ onHand: 5, pricePaise: 149900 });
    const b = await makeVariant({ onHand: 5, pricePaise: 89900 });
    const { order } = await placeOrder(
      db,
      baseInput({
        lines: [
          { variantId: a, quantity: 1 },
          { variantId: b, quantity: 2 },
        ],
      }),
    );
    expect(order.totalPaise).toBe(
      order.subtotalPaise -
        order.discountPaise +
        order.shippingPaise +
        order.codFeePaise +
        order.taxPaise,
    );
    const items = await db.orderItem.findMany({ where: { orderId: order.id } });
    const lineSum = items.reduce((s, i) => s + i.totalPaise, 0);
    expect(order.totalPaise).toBe(lineSum + order.shippingPaise + order.codFeePaise);
    // inclusive extraction — taxable + tax per line = the paid line total
    for (const i of items) {
      expect(i.taxableValuePaise + i.cgstPaise + i.sgstPaise + i.igstPaise).toBe(
        i.totalPaise,
      );
    }
  });
});

describe("prepaid vs COD placement (AC-09)", () => {
  it("prepaid → PENDING_PAYMENT + reservation; COD → PENDING_CONFIRMATION + committed stock", async () => {
    const v1 = await makeVariant({ onHand: 5 });
    const prepaid = await placeOrder(
      db,
      baseInput({ lines: [{ variantId: v1, quantity: 2 }] }),
    );
    expect(prepaid.order.orderStatus).toBe("PENDING_PAYMENT");
    expect(prepaid.order.paymentStatus).toBe("UNPAID");
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v1 } })).reservedQty,
    ).toBe(2);
    expect(prepaid.guestAccessToken).toBeTruthy();

    const v2 = await makeVariant({ onHand: 5 });
    const cod = await placeOrder(
      db,
      baseInput({ paymentMethod: "COD", lines: [{ variantId: v2, quantity: 3 }] }),
    );
    expect(cod.order.orderStatus).toBe("PENDING_CONFIRMATION");
    expect(cod.order.paymentStatus).toBe("COD_PENDING");
    expect(cod.order.codFeePaise).toBe(3000);
    const v2row = await db.productVariant.findUniqueOrThrow({ where: { id: v2 } });
    expect(v2row.onHandQty).toBe(2);
    expect(v2row.reservedQty).toBe(0);
  });
});

describe("COD lifecycle (AC-09)", () => {
  it("confirm is idempotent; cancel restores committed stock exactly once", async () => {
    const v = await makeVariant({ onHand: 4 });
    const { order } = await placeOrder(
      db,
      baseInput({ paymentMethod: "COD", lines: [{ variantId: v, quantity: 3 }] }),
    );
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(1);

    const c1 = await confirmCodOrder(db, { orderId: order.id });
    expect(c1.orderStatus).toBe("CONFIRMED");
    const c2 = await confirmCodOrder(db, { orderId: order.id });
    expect(c2.orderStatus).toBe("CONFIRMED");

    // cancel a confirmed-but-unshipped COD order
    await cancelOrder(db, { orderId: order.id, reason: "test" });
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(4);
    await cancelOrder(db, { orderId: order.id, reason: "again" });
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).onHandQty,
    ).toBe(4);
  });
});

describe("prepaid cancel + capture settlement (AC-05/08)", () => {
  it("cancel releases the reservation once", async () => {
    const v = await makeVariant({ onHand: 3 });
    const { order } = await placeOrder(
      db,
      baseInput({ lines: [{ variantId: v, quantity: 2 }] }),
    );
    await cancelOrder(db, { orderId: order.id, reason: "changed mind" });
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).reservedQty,
    ).toBe(0);
    const res = await db.inventoryReservation.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(res.status).toBe("RELEASED");
  });

  it("captured payment converts the reservation and confirms; late capture after reallocation → NEEDS_REVIEW + PAID", async () => {
    const v = await makeVariant({ onHand: 1, oneOfOne: true, pricePaise: 50000 });
    const { order } = await placeOrder(
      db,
      baseInput({ lines: [{ variantId: v, quantity: 1 }] }),
    );

    const good = await settleCapturedPayment(db, {
      orderId: order.id,
      capturedAmountPaise: order.totalPaise,
    });
    expect(good.outcome).toBe("converted");
    expect(good.order.orderStatus).toBe("CONFIRMED");
    expect(good.order.paymentStatus).toBe("PAID");
    const vrow = await db.productVariant.findUniqueOrThrow({ where: { id: v } });
    expect(vrow.onHandQty).toBe(0);
    expect(vrow.reservedQty).toBe(0);

    // Second order on a now-empty one-of-one, let it expire, then "capture late"
    const v2 = await makeVariant({ onHand: 1, oneOfOne: true, pricePaise: 50000 });
    const late = await placeOrder(
      db,
      baseInput({ lines: [{ variantId: v2, quantity: 1 }] }),
    );
    await db.inventoryReservation.updateMany({
      where: { orderId: late.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await db.$transaction((tx) => expireReservations(tx, {}));
    // meanwhile the piece was sold to someone else
    await db.productVariant.update({ where: { id: v2 }, data: { onHandQty: 0 } });

    const settled = await settleCapturedPayment(db, {
      orderId: late.order.id,
      capturedAmountPaise: late.order.totalPaise,
    });
    expect(settled.outcome).toBe("needs_review");
    expect(settled.order.orderStatus).toBe("NEEDS_REVIEW");
    expect(settled.order.paymentStatus).toBe("PAID"); // never hidden as failed
  });
});

describe("outbox on placement (AC-10 foundation)", () => {
  it("writes a DomainEvent + OutboxEvent + OrderEvent in the same transaction", async () => {
    const v = await makeVariant({ onHand: 2 });
    const { order } = await placeOrder(
      db,
      baseInput({ lines: [{ variantId: v, quantity: 1 }] }),
    );
    expect(
      await db.orderEvent.count({ where: { orderId: order.id, type: "order.placed" } }),
    ).toBe(1);
    const de = await db.domainEvent.findFirstOrThrow({
      where: { aggregateId: order.id, type: "order.placed" },
    });
    expect(
      await db.outboxEvent.count({
        where: { domainEventId: de.id, status: "PENDING" },
      }),
    ).toBe(1);
  });
});

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AdminUser, PrismaClient } from "../../src/generated/prisma";
import { placeOrder, type AddressInput } from "../../src/server/checkout/place-order";
import { computeQuote, DiscountCodeQuoteError } from "../../src/server/checkout/quote";
import {
  countActiveUses,
  createDiscountCode,
  deleteDiscountCode,
  updateDiscountCode,
} from "../../src/server/discounts";
import { cancelOrder } from "../../src/server/orders/lifecycle";
import { makeClient, resetDb } from "./helpers";

/** Discount codes at checkout (D-140). */

let db: PrismaClient;
let admin: AdminUser;

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
    data: { key: "checkout.rules", value: { reservationTtlSeconds: 600 } },
  });
  admin = await db.adminUser.create({
    data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
  });
});

async function makeVariant(opts: {
  pricePaise: number;
  closet?: boolean;
  onHand?: number;
}) {
  const closet = opts.closet ?? false;
  const p = await db.product.create({
    data: {
      catalog: closet ? "THRIFT" : "THE_POOJA_EDIT",
      slug: `p-${randomUUID().slice(0, 8)}`,
      title: closet ? "Closet piece" : "Label kurta",
      status: "PUBLISHED",
      publishedAt: new Date(),
      taxClass: {
        create: {
          code: `TC-${randomUUID().slice(0, 8)}`,
          name: "5% inclusive",
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
      ...(closet
        ? {
            thriftDetails: {
              create: { conditionGrade: "GOOD", measurements: {}, isOneOfOne: false },
            },
          }
        : {}),
    },
  });
  const v = await db.productVariant.create({
    data: {
      productId: p.id,
      sku: `SKU-${randomUUID().slice(0, 8)}`,
      pricePaise: opts.pricePaise,
      onHandQty: opts.onHand ?? 10,
    },
  });
  return v.id;
}

const addr: AddressInput = {
  name: "Buyer",
  phone: "+919999900000",
  line1: "1 St",
  city: "Jaipur",
  stateName: "Rajasthan",
  stateCode: "08",
  postcode: "302001",
};

const place = (
  lines: { variantId: string; quantity: number }[],
  extra: Partial<Parameters<typeof placeOrder>[1]> = {},
) =>
  placeOrder(db, {
    idempotencyKey: randomUUID(),
    scope: `guest:${randomUUID().slice(0, 12)}`,
    contact: { phone: "+919999900000" },
    lines,
    paymentMethod: "PREPAID_RAZORPAY",
    billing: addr,
    shipping: addr,
    ...extra,
  });

const quote = (
  lines: { variantId: string; quantity: number }[],
  code?: string,
  now?: Date,
) =>
  computeQuote(db, {
    lines,
    paymentMethod: "PREPAID_RAZORPAY",
    destination: { stateCode: "08", postcode: "302001" },
    discountCode: code ?? null,
    now,
  });

const newCode = (over: Partial<Parameters<typeof createDiscountCode>[2]> = {}) =>
  createDiscountCode(db, admin, {
    code: "SAVE10",
    kind: "PERCENT",
    percent: 10,
    appliesTo: "ALL",
    isActive: true,
    ...over,
  });

describe("discount codes in the quote", () => {
  it("takes 10% off only the Label line of a mixed cart, GST on the discounted price", async () => {
    await newCode({ appliesTo: "LABEL" });
    const label = await makeVariant({ pricePaise: 200_000 });
    const closet = await makeVariant({ pricePaise: 100_000, closet: true });
    const lines = [
      { variantId: label, quantity: 1 },
      { variantId: closet, quantity: 1 },
    ];
    const plain = await quote(lines);
    const q = await quote(lines, " save10 ");

    expect(q.discountCode).toBe("SAVE10");
    expect(q.discountGrossPaise).toBe(20_000);
    // The shopper pays ₹200 less, shipping (Closet ₹100) untouched.
    expect(q.totalPaise).toBe(plain.totalPaise - 20_000);
    expect(q.shippingPaise).toBe(plain.shippingPaise);
    expect(q.lines[0].discountPaise).toBeGreaterThan(0);
    expect(q.lines[1].discountPaise).toBe(0);
    expect(q.lines[0].lineTotalPaise).toBe(180_000);
    expect(q.hash).not.toBe(plain.hash);
  });

  it("works on a sale item too (owner, 2026-10-07)", async () => {
    await newCode({ kind: "FIXED", amountPaise: 15_000, percent: null });
    const v = await makeVariant({ pricePaise: 99_900 });
    await db.productVariant.update({
      where: { id: v },
      data: { compareAtPaise: 149_900 },
    });
    const q = await quote([{ variantId: v, quantity: 1 }], "SAVE10");
    expect(q.discountGrossPaise).toBe(15_000);
  });

  it("rejects unknown, switched-off and expired codes with a shopper message", async () => {
    const v = await makeVariant({ pricePaise: 100_000 });
    await expect(quote([{ variantId: v, quantity: 1 }], "NOPE")).rejects.toBeInstanceOf(
      DiscountCodeQuoteError,
    );
    await newCode({ isActive: false });
    await expect(quote([{ variantId: v, quantity: 1 }], "SAVE10")).rejects.toThrow(
      "isn't valid",
    );
    await newCode({ code: "OLD", endsAt: new Date("2026-01-01") });
    await expect(quote([{ variantId: v, quantity: 1 }], "OLD")).rejects.toThrow(
      "expired",
    );
  });
});

describe("discount codes on placed orders", () => {
  it("snapshots the code, per-line discounts and a redemption; totals reconcile", async () => {
    await newCode();
    const a = await makeVariant({ pricePaise: 149_900 });
    const b = await makeVariant({ pricePaise: 89_900 });
    const { order } = await place(
      [
        { variantId: a, quantity: 1 },
        { variantId: b, quantity: 2 },
      ],
      { discountCode: "SAVE10" },
    );
    expect(order.discountCode).toBe("SAVE10");
    const items = await db.orderItem.findMany({ where: { orderId: order.id } });
    expect(items.reduce((s, i) => s + i.discountPaise, 0)).toBe(order.discountPaise);
    const gross = 149_900 + 2 * 89_900;
    const codeOff = Math.floor(gross / 10);
    expect(order.totalPaise).toBe(gross - codeOff + order.shippingPaise);
    expect(order.totalPaise).toBe(
      items.reduce((s, i) => s + i.totalPaise, 0) + order.shippingPaise,
    );
    const r = await db.discountRedemption.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(r.amountPaise).toBe(codeOff);
  });

  it("a one-use code: second order refused; cancelling the first gives the use back", async () => {
    const code = await newCode({ maxRedemptions: 1 });
    const v = await makeVariant({ pricePaise: 100_000 });
    const first = await place([{ variantId: v, quantity: 1 }], {
      discountCode: "SAVE10",
    });
    await expect(
      place([{ variantId: v, quantity: 1 }], { discountCode: "SAVE10" }),
    ).rejects.toThrow("fully used");

    await cancelOrder(db, { orderId: first.order.id, reason: "test" });
    const r = await db.discountRedemption.findUniqueOrThrow({
      where: { orderId: first.order.id },
    });
    expect(r.releasedAt).not.toBeNull();
    await expect(
      place([{ variantId: v, quantity: 1 }], { discountCode: "SAVE10" }),
    ).resolves.toBeTruthy();
    expect(
      await countActiveUses(db, code.id, { now: new Date(), ttlSeconds: 600 }),
    ).toBe(1);
  });

  it("an abandoned unpaid order stops counting once its payment window passes", async () => {
    const code = await newCode({ maxRedemptions: 1 });
    const v = await makeVariant({ pricePaise: 100_000 });
    const placedAt = new Date(Date.now() - 20 * 60_000); // 20 min ago, TTL 10 min
    await place([{ variantId: v, quantity: 1 }], {
      discountCode: "SAVE10",
      now: placedAt,
    });
    expect(
      await countActiveUses(db, code.id, { now: new Date(), ttlSeconds: 600 }),
    ).toBe(0);
    await expect(
      quote([{ variantId: v, quantity: 1 }], "SAVE10"),
    ).resolves.toBeTruthy();
  });

  it("two checkouts racing for the last use: exactly one wins", async () => {
    await newCode({ maxRedemptions: 1 });
    const v = await makeVariant({ pricePaise: 100_000 });
    const results = await Promise.allSettled([
      place([{ variantId: v, quantity: 1 }], { discountCode: "SAVE10" }),
      place([{ variantId: v, quantity: 1 }], { discountCode: "SAVE10" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.discountRedemption.count()).toBe(1);
  });
});

describe("admin discount codes", () => {
  it("validates, refuses duplicates, locks the text and blocks delete once used", async () => {
    await expect(newCode({ percent: 0 })).rejects.toThrow("more than 0");
    await expect(newCode({ code: "a b" })).rejects.toThrow("3–30 letters");
    const code = await newCode();
    await expect(newCode({ code: "save10" })).rejects.toThrow("already exists");

    const v = await makeVariant({ pricePaise: 100_000 });
    await place([{ variantId: v, quantity: 1 }], { discountCode: "SAVE10" });
    const base = {
      code: "SAVE10",
      kind: "PERCENT" as const,
      percent: 15,
      appliesTo: "ALL" as const,
      isActive: false,
    };
    await expect(
      updateDiscountCode(db, admin, code.id, { ...base, code: "SAVE15" }),
    ).rejects.toThrow("can't change");
    const updated = await updateDiscountCode(db, admin, code.id, base);
    expect(updated.percentBps).toBe(1500);
    expect(updated.isActive).toBe(false);
    await expect(deleteDiscountCode(db, admin, code.id)).rejects.toThrow(
      "Switch it off",
    );
  });
});

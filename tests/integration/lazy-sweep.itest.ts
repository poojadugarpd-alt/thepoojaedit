import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@poojaedit/db";
import { listPublishedProducts } from "../../src/server/catalog/queries";
import { placeOrder, type AddressInput } from "../../src/server/checkout/place-order";
import {
  MIN_INTERVAL_MS,
  resetLazySweepForTests,
  sweepExpiredHolds,
} from "../../src/server/inventory/lazy-sweep";
import { makeClient, resetDb } from "./helpers";

/**
 * Abandoned holds free themselves without the Inngest cron (Nov 2026: the free
 * plan ran out and nothing released them, so a one-of-one piece stayed "On hold").
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
  resetLazySweepForTests();
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
  return { slug: p.slug, variantId: v.id };
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

/** The buyer walked away: the hold's time has passed, nobody has swept it. */
async function abandon(orderId: string) {
  await db.inventoryReservation.updateMany({
    where: { orderId },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
}

const reserved = async (variantId: string) =>
  (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).reservedQty;

describe("sweepExpiredHolds", () => {
  it("frees an abandoned hold, so the piece shows as available again", async () => {
    const { slug, variantId } = await makePiece();
    const order = await placePrepaid(variantId);
    await abandon(order.id);
    resetLazySweepForTests(); // minutes pass between the abandoned checkout and the next visitor
    expect(await reserved(variantId)).toBe(1); // still counted as held

    const page = await listPublishedProducts(db, { catalog: "THRIFT" });

    expect(await reserved(variantId)).toBe(0);
    const card = page.items.find((c) => c.slug === slug);
    expect(card?.availability).toBe("IN_STOCK");
  });

  it("lets a second buyer take a piece whose first buyer abandoned it", async () => {
    const { variantId } = await makePiece();
    const first = await placePrepaid(variantId);
    await abandon(first.id);

    const second = await placePrepaid(variantId); // would throw if the hold still blocked it
    expect(second.id).not.toBe(first.id);
    expect(await reserved(variantId)).toBe(1);
  });

  it("never touches a hold that is still running", async () => {
    const { variantId } = await makePiece();
    await placePrepaid(variantId);
    await sweepExpiredHolds(db, { force: true });
    expect(await reserved(variantId)).toBe(1);
  });

  it("runs at most once per interval unless forced", async () => {
    const { variantId } = await makePiece();
    const order = await placePrepaid(variantId);
    const t = Date.now();
    await sweepExpiredHolds(db, { now: t }); // nothing expired yet; starts the interval
    await abandon(order.id);

    await sweepExpiredHolds(db, { now: t + 1_000 }); // inside the interval: skipped
    expect(await reserved(variantId)).toBe(1);

    await sweepExpiredHolds(db, { now: t + MIN_INTERVAL_MS + 1 }); // next interval: runs
    expect(await reserved(variantId)).toBe(0);
  });
});

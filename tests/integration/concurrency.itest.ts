import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { makeClient, resetDb } from "./helpers";

/**
 * Real row-lock concurrency (AC-04 foundation). Two independent Prisma clients
 * (separate pools → separate PostgreSQL connections) contend for the last unit.
 */
let a: PrismaClient;
let b: PrismaClient;
let setupDb: PrismaClient;

beforeAll(() => {
  a = makeClient();
  b = makeClient();
  setupDb = makeClient();
});
afterAll(async () => {
  await Promise.all([a.$disconnect(), b.$disconnect(), setupDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb(setupDb);
});

async function makeVariant(sku: string, onHandQty: number): Promise<string> {
  const product = await setupDb.product.create({
    data: { catalog: "THRIFT", slug: sku, title: sku, status: "PUBLISHED" },
  });
  const variant = await setupDb.productVariant.create({
    data: { productId: product.id, sku, pricePaise: 5000, onHandQty },
  });
  return variant.id;
}

/** Conditional reservation: succeeds only while a unit is available. */
async function reserve(
  client: PrismaClient,
  variantId: string,
  qty: number,
  holdMs = 40,
): Promise<void> {
  await client.$transaction(async (tx) => {
    const affected = await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant"
       SET "reservedQty" = "reservedQty" + $2::int
       WHERE "id" = $1::uuid AND "onHandQty" - "reservedQty" >= $2::int`,
      variantId,
      qty,
    );
    if (affected === 0) throw new Error("SOLD_OUT");
    await new Promise((r) => setTimeout(r, holdMs));
  });
}

describe("one-of-one contention", () => {
  it("lets exactly one of two concurrent buyers reserve the last unit", async () => {
    const variantId = await makeVariant("contend-1", 1);

    const results = await Promise.allSettled([
      reserve(a, variantId, 1),
      reserve(b, variantId, 1),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter(
      (r) => r.status === "rejected" && (r.reason as Error).message === "SOLD_OUT",
    ).length;

    expect(fulfilled).toBe(1);
    expect(rejected).toBe(1);

    const v = await setupDb.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(v.reservedQty).toBe(1);
    expect(v.reservedQty).toBeLessThanOrEqual(v.onHandQty);
  });

  it("never lets 5 concurrent buyers reserve more than the 3 available", async () => {
    const variantId = await makeVariant("contend-3", 3);

    const clients = [a, b, makeClient(), makeClient(), makeClient()];
    try {
      const results = await Promise.allSettled(
        clients.map((c) => reserve(c, variantId, 1, 20)),
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      expect(fulfilled).toBe(3);

      const v = await setupDb.productVariant.findUniqueOrThrow({
        where: { id: variantId },
      });
      expect(v.reservedQty).toBe(3);
    } finally {
      await Promise.all(clients.slice(2).map((c) => c.$disconnect()));
    }
  });
});

describe("all-or-nothing mixed reservation", () => {
  it("rolls back an earlier item's reservation when a later item is sold out", async () => {
    const available = await makeVariant("mixed-ok", 5);
    const soldOut = await makeVariant("mixed-soldout", 0);

    await expect(
      a.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE "ProductVariant" SET "reservedQty" = "reservedQty" + 1
           WHERE "id" = $1::uuid AND "onHandQty" - "reservedQty" >= 1`,
          available,
        );
        const second = await tx.$executeRawUnsafe(
          `UPDATE "ProductVariant" SET "reservedQty" = "reservedQty" + 1
           WHERE "id" = $1::uuid AND "onHandQty" - "reservedQty" >= 1`,
          soldOut,
        );
        if (second === 0) throw new Error("SOLD_OUT");
      }),
    ).rejects.toThrow("SOLD_OUT");

    const v = await setupDb.productVariant.findUniqueOrThrow({
      where: { id: available },
    });
    expect(v.reservedQty).toBe(0); // rolled back
  });
});

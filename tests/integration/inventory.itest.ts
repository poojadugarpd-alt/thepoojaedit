import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { allocateCodStock, cancelCodAllocation } from "../../src/server/inventory/cod";
import {
  InsufficientStockError,
  ReservationNotActiveError,
} from "../../src/server/inventory/errors";
import {
  convertReservations,
  expireReservations,
  reacquireForLateCapture,
  releaseReservations,
  reserveAll,
} from "../../src/server/inventory/reservations";
import { makeClient, resetDb } from "./helpers";

let db: PrismaClient;
let db2: PrismaClient;

beforeAll(() => {
  db = makeClient();
  db2 = makeClient();
});
afterAll(async () => {
  await Promise.all([db.$disconnect(), db2.$disconnect()]);
});
beforeEach(async () => {
  await resetDb(db);
});

async function makeVariant(onHand: number): Promise<string> {
  const p = await db.product.create({
    data: {
      catalog: "THRIFT",
      slug: `v-${randomUUID().slice(0, 8)}`,
      title: "v",
      status: "PUBLISHED",
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
async function makeOrder(): Promise<string> {
  const o = await db.order.create({
    data: {
      orderNumber: `O-${randomUUID().slice(0, 10)}`,
      contactPhone: "+910000000000",
      paymentMethod: "PREPAID_RAZORPAY",
      subtotalPaise: 50000,
      totalPaise: 50000,
    },
  });
  return o.id;
}
const variantState = (id: string) =>
  db.productVariant.findUniqueOrThrow({
    where: { id },
    select: { onHandQty: true, reservedQty: true },
  });

describe("reserveAll — atomic, all-or-nothing (AC-04)", () => {
  it("two connections contend for the last one-of-one unit: exactly one wins", async () => {
    const variantId = await makeVariant(1);
    const [o1, o2] = [await makeOrder(), await makeOrder()];

    const attempt = (client: PrismaClient, orderId: string) =>
      client.$transaction(async (tx) => {
        await reserveAll(tx, {
          orderId,
          lines: [{ variantId, quantity: 1 }],
          ttlSeconds: 600,
        });
        await new Promise((r) => setTimeout(r, 40));
      });

    const results = await Promise.allSettled([attempt(db, o1), attempt(db2, o2)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(InsufficientStockError);

    const v = await variantState(variantId);
    expect(v.reservedQty).toBe(1);
    expect(v.reservedQty).toBeLessThanOrEqual(v.onHandQty);
    expect(await db.inventoryReservation.count({ where: { status: "ACTIVE" } })).toBe(
      1,
    );
  });

  it("a shortfall on the last mixed-cart line rolls back the earlier reservations", async () => {
    const available = await makeVariant(5);
    const soldOut = await makeVariant(0);
    const orderId = await makeOrder();

    await expect(
      db.$transaction((tx) =>
        reserveAll(tx, {
          orderId,
          lines: [
            { variantId: available, quantity: 2 },
            { variantId: soldOut, quantity: 1 },
          ],
          ttlSeconds: 600,
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    expect((await variantState(available)).reservedQty).toBe(0);
    expect(await db.inventoryReservation.count()).toBe(0);
    expect(await db.inventoryTransaction.count()).toBe(0);
  });

  it("rejects a negative quantity", async () => {
    const variantId = await makeVariant(5);
    const orderId = await makeOrder();
    await expect(
      db.$transaction((tx) =>
        reserveAll(tx, {
          orderId,
          lines: [{ variantId, quantity: -1 }],
          ttlSeconds: 600,
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });
});

describe("release / expiry (AC-05)", () => {
  it("expiry releases an ACTIVE reservation exactly once and never goes negative", async () => {
    const variantId = await makeVariant(3);
    const orderId = await makeOrder();
    await db.$transaction((tx) =>
      reserveAll(tx, { orderId, lines: [{ variantId, quantity: 2 }], ttlSeconds: -1 }),
    );
    expect((await variantState(variantId)).reservedQty).toBe(2);

    const n1 = await db.$transaction((tx) => expireReservations(tx, {}));
    expect(n1).toBe(1);
    expect((await variantState(variantId)).reservedQty).toBe(0);

    const n2 = await db.$transaction((tx) => expireReservations(tx, {}));
    expect(n2).toBe(0);

    const res = await db.inventoryReservation.findFirstOrThrow({ where: { orderId } });
    expect(res.status).toBe("EXPIRED");
    const ledger = await db.inventoryTransaction.findMany({ where: { orderId } });
    expect(ledger.map((l) => l.type).sort()).toEqual(["RELEASE", "RESERVE"]);
  });

  it("repeated release is a no-op", async () => {
    const variantId = await makeVariant(3);
    const orderId = await makeOrder();
    await db.$transaction((tx) =>
      reserveAll(tx, { orderId, lines: [{ variantId, quantity: 1 }], ttlSeconds: 600 }),
    );
    expect(await db.$transaction((tx) => releaseReservations(tx, { orderId }))).toBe(1);
    expect(await db.$transaction((tx) => releaseReservations(tx, { orderId }))).toBe(0);
    expect((await variantState(variantId)).reservedQty).toBe(0);
  });
});

describe("expiry vs conversion race (AC-05)", () => {
  it("exactly one of {expire, convert} takes effect; stock stays consistent", async () => {
    const variantId = await makeVariant(1);
    const orderId = await makeOrder();
    await db.$transaction((tx) =>
      reserveAll(tx, { orderId, lines: [{ variantId, quantity: 1 }], ttlSeconds: -1 }),
    );

    const expireRun = db
      .$transaction((tx) => expireReservations(tx, {}))
      .then(
        (n) => ({ kind: "expire" as const, n }),
        (e) => ({ kind: "expire-err" as const, e }),
      );
    const convertRun = db2
      .$transaction((tx) => convertReservations(tx, { orderId }))
      .then(
        (n) => ({ kind: "convert" as const, n }),
        (e) => ({ kind: "convert-err" as const, e }),
      );

    const [a, b] = await Promise.all([expireRun, convertRun]);
    const outcomes = [a, b];

    const converted = outcomes.some((o) => o.kind === "convert" && o.n === 1);
    const expired = outcomes.some((o) => o.kind === "expire" && o.n === 1);
    expect(converted !== expired).toBe(true); // exactly one

    const res = await db.inventoryReservation.findFirstOrThrow({ where: { orderId } });
    const v = await variantState(variantId);
    if (converted) {
      expect(res.status).toBe("CONVERTED");
      expect(v.onHandQty).toBe(0);
      expect(v.reservedQty).toBe(0);
      // the convert loser saw a non-ACTIVE row
      expect(
        outcomes.find((o) => o.kind === "expire")?.["n"] === 0 ||
          outcomes.some((o) => o.kind === "expire-err"),
      ).toBe(true);
    } else {
      expect(res.status).toBe("EXPIRED");
      expect(v.onHandQty).toBe(1);
      expect(v.reservedQty).toBe(0);
      expect(outcomes.some((o) => o.kind === "convert-err")).toBe(true);
    }
    expect(v.reservedQty).toBeGreaterThanOrEqual(0);
    expect(v.onHandQty).toBeGreaterThanOrEqual(0);
  });

  it("convert decreases on-hand and reserved once; a second convert throws", async () => {
    const variantId = await makeVariant(2);
    const orderId = await makeOrder();
    await db.$transaction((tx) =>
      reserveAll(tx, { orderId, lines: [{ variantId, quantity: 2 }], ttlSeconds: 600 }),
    );
    expect(await db.$transaction((tx) => convertReservations(tx, { orderId }))).toBe(1);
    const v = await variantState(variantId);
    expect(v.onHandQty).toBe(0);
    expect(v.reservedQty).toBe(0);
    await expect(
      db.$transaction((tx) => convertReservations(tx, { orderId })),
    ).rejects.toBeInstanceOf(ReservationNotActiveError);
  });
});

describe("COD allocation (AC-09)", () => {
  it("allocates committed stock all-or-nothing", async () => {
    const a = await makeVariant(5);
    const short = await makeVariant(0);
    const orderId = await makeOrder();

    await expect(
      db.$transaction((tx) =>
        allocateCodStock(tx, {
          orderId,
          lines: [
            { variantId: a, quantity: 2 },
            { variantId: short, quantity: 1 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect((await variantState(a)).onHandQty).toBe(5);

    await db.$transaction((tx) =>
      allocateCodStock(tx, { orderId, lines: [{ variantId: a, quantity: 2 }] }),
    );
    const v = await variantState(a);
    expect(v.onHandQty).toBe(3);
    expect(v.reservedQty).toBe(0);
  });

  it("cancellation restores unshipped committed stock exactly once", async () => {
    const variantId = await makeVariant(4);
    const orderId = await makeOrder();
    await db.$transaction((tx) =>
      allocateCodStock(tx, { orderId, lines: [{ variantId, quantity: 3 }] }),
    );
    expect((await variantState(variantId)).onHandQty).toBe(1);

    expect(await db.$transaction((tx) => cancelCodAllocation(tx, { orderId }))).toBe(1);
    expect((await variantState(variantId)).onHandQty).toBe(4);

    expect(await db.$transaction((tx) => cancelCodAllocation(tx, { orderId }))).toBe(0);
    expect((await variantState(variantId)).onHandQty).toBe(4);
  });
});

describe("late-capture reacquire (AC-08)", () => {
  it("takes stock when available, refuses when it has been reallocated", async () => {
    const variantId = await makeVariant(1);
    const orderId = await makeOrder();

    await db.$transaction((tx) =>
      reacquireForLateCapture(tx, { orderId, lines: [{ variantId, quantity: 1 }] }),
    );
    expect((await variantState(variantId)).onHandQty).toBe(0);

    await expect(
      db.$transaction((tx) =>
        reacquireForLateCapture(tx, {
          orderId,
          lines: [{ variantId, quantity: 1 }],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });
});

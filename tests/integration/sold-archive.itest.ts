import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CatalogType, PrismaClient } from "../../src/generated/prisma";
import { archiveSoldClosetPieces } from "../../src/server/catalog/sold-archive";
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
});

const NOW = new Date("2026-10-10T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

async function piece(opts: {
  catalog?: CatalogType;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  onHand: number;
  reserved?: number;
  soldDaysAgo?: number;
  markedSoldOut?: boolean;
}) {
  const product = await db.product.create({
    data: {
      catalog: opts.catalog ?? "THRIFT",
      slug: `p-${randomUUID().slice(0, 8)}`,
      title: "piece",
      status: opts.status ?? "PUBLISHED",
      publishedAt: daysAgo(30),
      markedSoldOut: opts.markedSoldOut ?? false,
      variants: {
        create: {
          sku: `SKU-${randomUUID().slice(0, 8)}`,
          pricePaise: 10_000,
          onHandQty: opts.onHand,
          reservedQty: opts.reserved ?? 0,
        },
      },
    },
    include: { variants: true },
  });
  if (opts.soldDaysAgo !== undefined) {
    await db.inventoryTransaction.create({
      data: {
        variantId: product.variants[0].id,
        type: "CONVERT",
        onHandDelta: -1,
        reservedDelta: -1,
        idempotencyKey: randomUUID(),
        createdAt: daysAgo(opts.soldDaysAgo),
      },
    });
  }
  return product;
}

async function statusOf(id: string) {
  return (await db.product.findUniqueOrThrow({ where: { id } })).status;
}

describe("archiveSoldClosetPieces (D-143)", () => {
  it("archives a Closet piece sold more than 3 days ago and keeps one sold 2 days ago", async () => {
    const old = await piece({ onHand: 0, soldDaysAgo: 4 });
    const recent = await piece({ onHand: 0, soldDaysAgo: 2 });
    const { archived } = await archiveSoldClosetPieces(db, { now: NOW });
    expect(archived.map((a) => a.id)).toEqual([old.id]);
    expect(await statusOf(old.id)).toBe("ARCHIVED");
    expect(await statusOf(recent.id)).toBe("PUBLISHED");
  });

  it("never archives a piece that is only reserved in an unpaid checkout", async () => {
    const reserved = await piece({ onHand: 1, reserved: 1 });
    await archiveSoldClosetPieces(db, { now: NOW, graceDays: 0 });
    expect(await statusOf(reserved.id)).toBe("PUBLISHED");
  });

  it("leaves pieces still in stock, Label products, and drafts alone", async () => {
    const inStock = await piece({ onHand: 1 });
    const label = await piece({
      catalog: "THE_POOJA_EDIT",
      onHand: 0,
      soldDaysAgo: 10,
    });
    const draft = await piece({ status: "DRAFT", onHand: 0, soldDaysAgo: 10 });
    const { archived } = await archiveSoldClosetPieces(db, { now: NOW });
    expect(archived).toEqual([]);
    expect(await statusOf(inStock.id)).toBe("PUBLISHED");
    expect(await statusOf(label.id)).toBe("PUBLISHED");
    expect(await statusOf(draft.id)).toBe("DRAFT");
  });

  it("times the owner's Sold-out switch from when it was ticked", async () => {
    const admin = await db.adminUser.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com` },
    });
    const ticked = async (d: number) => {
      const p = await piece({ onHand: 1, markedSoldOut: true });
      await db.adminActivityLog.create({
        data: {
          adminUserId: admin.id,
          action: "product.marked_sold_out",
          entityType: "Product",
          entityId: p.id,
          createdAt: daysAgo(d),
        },
      });
      return p;
    };
    const old = await ticked(5);
    const recent = await ticked(1);
    await archiveSoldClosetPieces(db, { now: NOW });
    expect(await statusOf(old.id)).toBe("ARCHIVED");
    expect(await statusOf(recent.id)).toBe("PUBLISHED");
  });

  it("with graceDays 0 (the admin's 'hide now' button) archives everything sold", async () => {
    const today = await piece({ onHand: 0, soldDaysAgo: 0 });
    const { archived } = await archiveSoldClosetPieces(db, { now: NOW, graceDays: 0 });
    expect(archived.map((a) => a.id)).toEqual([today.id]);
  });
});

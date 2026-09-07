import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CatalogType, PrismaClient } from "../../src/generated/prisma";
import {
  getActiveCollection,
  getPublishedProduct,
  listPublishedProducts,
  searchPublishedProducts,
} from "../../src/server/catalog/queries";
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

let seq = 0;
async function makeProduct(opts: {
  catalog: CatalogType;
  slug?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  onHand?: number;
  oneOfOne?: boolean;
  acquisitionCostPaise?: number | null;
  title?: string;
  brand?: string;
}) {
  const slug = opts.slug ?? `p-${++seq}`;
  const status = opts.status ?? "PUBLISHED";
  const isThrift = opts.catalog === "THRIFT";
  return db.product.create({
    data: {
      catalog: opts.catalog,
      slug,
      title: opts.title ?? slug,
      brand: opts.brand ?? null,
      status,
      publishedAt: status === "PUBLISHED" ? new Date(Date.now() - ++seq * 1000) : null,
      variants: {
        create: {
          sku: `SKU-${randomUUID().slice(0, 8)}`,
          size: isThrift ? "M" : "S",
          pricePaise: 120000,
          onHandQty: opts.onHand ?? (isThrift ? 1 : 5),
        },
      },
      ...(isThrift
        ? {
            thriftDetails: {
              create: {
                conditionGrade: "GOOD",
                measurements: { chest: { value: "34", unit: null } },
                isOneOfOne: opts.oneOfOne ?? true,
                originalBrand: "Zara",
                acquisitionCostPaise: opts.acquisitionCostPaise ?? 45000,
                acquisitionDate: new Date("2026-01-01"),
              },
            },
          }
        : {}),
    },
  });
}

describe("catalog scoping (AC-01)", () => {
  it("a catalog listing never leaks the other catalog", async () => {
    await makeProduct({ catalog: "THE_POOJA_EDIT" });
    await makeProduct({ catalog: "THE_POOJA_EDIT" });
    await makeProduct({ catalog: "THRIFT" });

    const tpe = await listPublishedProducts(db, { catalog: "THE_POOJA_EDIT" });
    const thr = await listPublishedProducts(db, { catalog: "THRIFT" });

    expect(tpe.items).toHaveLength(2);
    expect(tpe.items.every((c) => c.catalog === "THE_POOJA_EDIT")).toBe(true);
    expect(thr.items).toHaveLength(1);
    expect(thr.items[0].catalog).toBe("THRIFT");
  });

  it("the same slug in both catalogs resolves independently", async () => {
    await makeProduct({
      catalog: "THE_POOJA_EDIT",
      slug: "linen-set",
      title: "New Linen Set",
    });
    await makeProduct({
      catalog: "THRIFT",
      slug: "linen-set",
      title: "Thrifted Linen Set",
    });

    const a = await getPublishedProduct(db, "THE_POOJA_EDIT", "linen-set");
    const b = await getPublishedProduct(db, "THRIFT", "linen-set");
    expect(a?.title).toBe("New Linen Set");
    expect(a?.thrift).toBeNull();
    expect(b?.title).toBe("Thrifted Linen Set");
    expect(b?.thrift).not.toBeNull();
  });
});

describe("publication vs availability (AC-02)", () => {
  it("hides DRAFT and ARCHIVED from listings and detail", async () => {
    await makeProduct({ catalog: "THRIFT", slug: "draft-one", status: "DRAFT" });
    await makeProduct({ catalog: "THRIFT", slug: "archived-one", status: "ARCHIVED" });
    await makeProduct({ catalog: "THRIFT", slug: "live-one", status: "PUBLISHED" });

    const list = await listPublishedProducts(db, { catalog: "THRIFT" });
    expect(list.items.map((c) => c.slug)).toEqual(["live-one"]);
    expect(await getPublishedProduct(db, "THRIFT", "draft-one")).toBeNull();
    expect(await getPublishedProduct(db, "THRIFT", "archived-one")).toBeNull();
  });

  it("a sold one-of-one thrift URL still resolves, marked SOLD, with no buyable variant", async () => {
    await makeProduct({
      catalog: "THRIFT",
      slug: "sold-scarf",
      onHand: 0,
      oneOfOne: true,
    });

    const detail = await getPublishedProduct(db, "THRIFT", "sold-scarf");
    expect(detail).not.toBeNull();
    expect(detail!.availability).toBe("SOLD");
    expect(detail!.variants.every((v) => v.available === false)).toBe(true);

    // ...and it is NOT in the normal listing's in-stock signal
    const card = (await listPublishedProducts(db, { catalog: "THRIFT" })).items[0];
    expect(card.availability).toBe("SOLD");
  });

  it("out-of-stock restockable apparel is OUT_OF_STOCK, not SOLD", async () => {
    await makeProduct({ catalog: "THE_POOJA_EDIT", slug: "oos-kurta", onHand: 0 });
    const d = await getPublishedProduct(db, "THE_POOJA_EDIT", "oos-kurta");
    expect(d!.availability).toBe("OUT_OF_STOCK");
  });
});

describe("public payload never exposes acquisition cost (master §5)", () => {
  it("thrift detail omits acquisitionCostPaise / acquisitionDate entirely", async () => {
    await makeProduct({
      catalog: "THRIFT",
      slug: "denim",
      acquisitionCostPaise: 99900,
    });
    const d = await getPublishedProduct(db, "THRIFT", "denim");
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/acquisition/i);
    expect(json).not.toContain("99900");
    expect(d!.thrift).not.toHaveProperty("acquisitionCostPaise");
    expect(d!.thrift).not.toHaveProperty("acquisitionDate");
  });

  it("variants expose only advisory fields, not reservedQty / thresholds", async () => {
    await makeProduct({ catalog: "THE_POOJA_EDIT", slug: "kurta" });
    const d = await getPublishedProduct(db, "THE_POOJA_EDIT", "kurta");
    const v = d!.variants[0];
    expect(Object.keys(v).sort()).toEqual(
      [
        "available",
        "color",
        "compareAtPaise",
        "id",
        "pricePaise",
        "size",
        "sku",
      ].sort(),
    );
  });
});

describe("collections", () => {
  it("returns only active, catalog-scoped, published members", async () => {
    const live = await makeProduct({ catalog: "THRIFT", slug: "in-col-live" });
    const draft = await makeProduct({
      catalog: "THRIFT",
      slug: "in-col-draft",
      status: "DRAFT",
    });
    const col = await db.collection.create({
      data: { catalog: "THRIFT", slug: "summer", name: "Summer", isActive: true },
    });
    const hidden = await db.collection.create({
      data: { catalog: "THRIFT", slug: "hidden", name: "Hidden", isActive: false },
    });
    await db.productCollection.createMany({
      data: [
        { productId: live.id, collectionId: col.id },
        { productId: draft.id, collectionId: col.id },
        { productId: live.id, collectionId: hidden.id },
      ],
    });

    const got = await getActiveCollection(db, "THRIFT", "summer");
    expect(got?.products.map((p) => p.slug)).toEqual(["in-col-live"]);
    expect(await getActiveCollection(db, "THRIFT", "hidden")).toBeNull();
    expect(await getActiveCollection(db, "THE_POOJA_EDIT", "summer")).toBeNull();
  });
});

describe("search", () => {
  it("filters by catalog and needs >= 2 chars", async () => {
    await makeProduct({
      catalog: "THE_POOJA_EDIT",
      slug: "marigold",
      title: "Marigold Kurta",
    });
    await makeProduct({
      catalog: "THRIFT",
      slug: "marigold-bag",
      title: "Marigold Thrift Bag",
    });

    expect(await searchPublishedProducts(db, { q: "m" })).toEqual([]);
    const all = await searchPublishedProducts(db, { q: "marigold" });
    expect(all).toHaveLength(2);
    const thrOnly = await searchPublishedProducts(db, {
      q: "marigold",
      catalog: "THRIFT",
    });
    expect(thrOnly.map((c) => c.slug)).toEqual(["marigold-bag"]);
  });
});

describe("pagination", () => {
  it("keyset cursor walks newest-first without gaps or repeats", async () => {
    for (let i = 0; i < 7; i++)
      await makeProduct({ catalog: "THRIFT", slug: `pg-${i}` });
    const p1 = await listPublishedProducts(db, { catalog: "THRIFT", limit: 3 });
    expect(p1.items).toHaveLength(3);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = await listPublishedProducts(db, {
      catalog: "THRIFT",
      limit: 3,
      cursor: p1.nextCursor,
    });
    const p3 = await listPublishedProducts(db, {
      catalog: "THRIFT",
      limit: 3,
      cursor: p2.nextCursor,
    });
    const slugs = [...p1.items, ...p2.items, ...p3.items].map((c) => c.slug);
    expect(new Set(slugs).size).toBe(7);
    expect(p3.nextCursor).toBeNull();
  });
});

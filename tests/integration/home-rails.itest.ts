import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AdminUser, PrismaClient } from "../../src/generated/prisma";
import sitemap from "../../src/app/sitemap";
import {
  addProductToCollection,
  createCollection,
  createProduct,
  ensureHomeCollections,
  publishProduct,
  setProductStatus,
  upsertThriftDetails,
  upsertVariant,
} from "../../src/server/catalog/admin";
import {
  getActiveCollection,
  getHomeRailProducts,
  listActiveCollections,
} from "../../src/server/catalog/queries";
import { makeClient, resetDb } from "./helpers";

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
  admin = await db.adminUser.create({
    data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
  });
});

async function publishedProduct(catalog: "THE_POOJA_EDIT" | "THRIFT", title: string) {
  const p = await createProduct(db, admin, { catalog, title });
  await upsertVariant(db, admin, p.id, {
    sku: `${title}-${randomUUID().slice(0, 6)}`,
    pricePaise: 50000,
    // 1, not more — a THRIFT variant defaults `isOneOfOne: true` (see
    // upsertThriftDetails below), which caps total on-hand at 1.
    onHandQty: 1,
  });
  await db.productImage.create({
    data: {
      productId: p.id,
      bucket: "product-images",
      path: `${p.id}/photo.jpg`,
      publicUrl: `https://example.invalid/${p.id}.jpg`,
      altText: title,
      isPrimary: true,
    },
  });
  if (catalog === "THRIFT") {
    await upsertThriftDetails(db, admin, p.id, {
      conditionGrade: "GOOD",
      measurements: { length: { value: "60", unit: "in" } },
    });
  }
  return publishProduct(db, admin, p.id);
}

// Owner feedback (2026-09-13, Part B) — the home page rails read Pooja's own
// ordering, falling back to today's "newest 12" when she hasn't curated one.
describe("getHomeRailProducts", () => {
  it("falls back to newest-12 when the internal collection doesn't exist yet", async () => {
    const a = await publishedProduct("THE_POOJA_EDIT", "Newest one");
    const rail = await getHomeRailProducts(db, "THE_POOJA_EDIT");
    expect(rail.map((p) => p.slug)).toContain(a.slug);
  });

  it("falls back to newest-12 when the internal collection exists but is empty", async () => {
    await ensureHomeCollections(db, admin);
    const a = await publishedProduct("THE_POOJA_EDIT", "Still newest");
    const rail = await getHomeRailProducts(db, "THE_POOJA_EDIT");
    expect(rail.map((p) => p.slug)).toContain(a.slug);
  });

  it("respects manual position when the rail has been curated", async () => {
    await ensureHomeCollections(db, admin);
    const col = await db.collection.findUniqueOrThrow({
      where: { catalog_slug: { catalog: "THE_POOJA_EDIT", slug: "home-label" } },
    });
    const older = await publishedProduct("THE_POOJA_EDIT", "Older piece");
    const newer = await publishedProduct("THE_POOJA_EDIT", "Newer piece");
    // Newest-first would put `newer` before `older`; manual curation reverses it.
    await addProductToCollection(db, admin, col.id, newer.id);
    await addProductToCollection(db, admin, col.id, older.id);

    const rail = await getHomeRailProducts(db, "THE_POOJA_EDIT");
    expect(rail.map((p) => p.slug)).toEqual([newer.slug, older.slug]);
  });

  it("skips an unpublished member instead of rendering it, without falling back while others remain", async () => {
    await ensureHomeCollections(db, admin);
    const col = await db.collection.findUniqueOrThrow({
      where: { catalog_slug: { catalog: "THE_POOJA_EDIT", slug: "home-label" } },
    });
    const visible = await publishedProduct("THE_POOJA_EDIT", "Stays visible");
    const hidden = await publishedProduct("THE_POOJA_EDIT", "Goes to draft");
    await addProductToCollection(db, admin, col.id, hidden.id);
    await addProductToCollection(db, admin, col.id, visible.id);
    await setProductStatus(db, admin, hidden.id, "DRAFT");

    const rail = await getHomeRailProducts(db, "THE_POOJA_EDIT");
    expect(rail.map((p) => p.slug)).toEqual([visible.slug]);
  });

  it("falls back to newest-12 when every member has become unpublished", async () => {
    await ensureHomeCollections(db, admin);
    const col = await db.collection.findUniqueOrThrow({
      where: { catalog_slug: { catalog: "THE_POOJA_EDIT", slug: "home-label" } },
    });
    const onlyMember = await publishedProduct("THE_POOJA_EDIT", "Curated then archived");
    await addProductToCollection(db, admin, col.id, onlyMember.id);
    await setProductStatus(db, admin, onlyMember.id, "ARCHIVED");
    const fallbackItem = await publishedProduct("THE_POOJA_EDIT", "Newest fallback");

    const rail = await getHomeRailProducts(db, "THE_POOJA_EDIT");
    expect(rail.map((p) => p.slug)).toEqual([fallbackItem.slug]);
  });

  it("caps at 12 items even when more are curated", async () => {
    await ensureHomeCollections(db, admin);
    const col = await db.collection.findUniqueOrThrow({
      where: { catalog_slug: { catalog: "THRIFT", slug: "home-closet" } },
    });
    for (let i = 0; i < 14; i++) {
      const p = await publishedProduct("THRIFT", `Rail item ${i}`);
      await addProductToCollection(db, admin, col.id, p.id);
    }
    const rail = await getHomeRailProducts(db, "THRIFT");
    expect(rail).toHaveLength(12);
  });
});

// Part B2 — the internal home-rail collections are an admin merchandising
// tool, not a shoppable collection page.
describe("internal collections are invisible to every public read", () => {
  it("listActiveCollections never returns an internal collection", async () => {
    await ensureHomeCollections(db, admin);
    const real = await createCollection(db, admin, {
      catalog: "THE_POOJA_EDIT",
      name: "A real collection",
    });
    // createCollection starts a normal collection inactive — activate it so
    // this test actually exercises "internal is excluded, active-normal is not".
    await db.collection.update({ where: { id: real.id }, data: { isActive: true } });
    const list = await listActiveCollections(db, "THE_POOJA_EDIT");
    expect(list.some((c) => c.slug === "home-label")).toBe(false);
    expect(list.some((c) => c.name === "A real collection")).toBe(true);
  });

  it("getActiveCollection resolves an internal slug to null (the route 404s)", async () => {
    await ensureHomeCollections(db, admin);
    const result = await getActiveCollection(db, "THE_POOJA_EDIT", "home-label");
    expect(result).toBeNull();
  });

  it("is absent from the sitemap", async () => {
    await ensureHomeCollections(db, admin);
    const real = await createCollection(db, admin, {
      catalog: "THRIFT",
      name: "Sitemap real collection",
    });
    await db.collection.update({ where: { id: real.id }, data: { isActive: true } });

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes("/home-label") || u.includes("/home-closet"))).toBe(
      false,
    );
    expect(urls.some((u) => u.includes(`/collections/${real.slug}`))).toBe(true);
  });
});

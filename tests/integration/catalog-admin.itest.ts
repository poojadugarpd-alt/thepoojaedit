import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AdminUser, PrismaClient } from "../../src/generated/prisma";
import type { StoragePort } from "../../src/lib/storage";
import { adjustStock } from "../../src/server/inventory/adjust";
import {
  ProductHasHistoryError,
  ValidationError,
  addProductToCollection,
  createCollection,
  createProduct,
  deleteProduct,
  ensureHomeCollections,
  getCollectionAdmin,
  listAdminProducts,
  listCollectionsAdmin,
  publishProduct,
  removeProductFromCollection,
  reorderCollectionProduct,
  searchAddableCollectionProducts,
  toggleFeatureOnHomePage,
  updateCollection,
  updateProduct,
  upsertThriftDetails,
  upsertVariant,
  validateForPublication,
} from "../../src/server/catalog/admin";
import { makeClient, resetDb } from "./helpers";

/** Records what was asked to be deleted, deletes nothing for real. */
function fakeStorage(): StoragePort & { deleted: { bucket: string; paths: string[] }[] } {
  const deleted: { bucket: string; paths: string[] }[] = [];
  return {
    deleted,
    async createSignedUploadUrl(bucket, path) {
      return { signedUrl: `https://fake/${bucket}/${path}`, token: "tok", path };
    },
    async statObject() {
      return { exists: true, size: 1000, contentType: "image/webp" };
    },
    async createSignedDownloadUrl(_b, path) {
      return `https://fake/download/${path}`;
    },
    async deleteObjects(bucket, paths) {
      deleted.push({ bucket, paths });
    },
  };
}

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

describe("createProduct", () => {
  it("creates a DRAFT, validates the slug, rejects a catalogue-scoped dup, and audits", async () => {
    const p = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      slug: "linen-pants",
      title: "Linen Pants",
    });
    expect(p.status).toBe("DRAFT");

    await expect(
      createProduct(db, admin, {
        catalog: "THE_POOJA_EDIT",
        slug: "linen-pants",
        title: "Dup",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    // same slug in the OTHER catalogue is fine
    await expect(
      createProduct(db, admin, {
        catalog: "THRIFT",
        slug: "linen-pants",
        title: "Thrifted",
      }),
    ).resolves.toBeDefined();

    await expect(
      createProduct(db, admin, { catalog: "THRIFT", slug: "Bad Slug", title: "x" }),
    ).rejects.toThrow(/slug/i);

    const logs = await db.adminActivityLog.findMany({
      where: { action: "product.create" },
    });
    expect(logs.length).toBe(2);
    expect(logs[0].adminUserId).toBe(admin.id);
  });

  // Owner feedback (2026-09-13): the admin UI no longer submits a slug at
  // all — createProduct must generate and unique one from the title.
  it("auto-generates a slug from the title when none is given, and suffixes -2/-3 on collision", async () => {
    const first = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      title: "Marigold Cotton Kurta",
    });
    expect(first.slug).toBe("marigold-cotton-kurta");

    const second = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      title: "Marigold Cotton Kurta",
    });
    expect(second.slug).toBe("marigold-cotton-kurta-2");

    const third = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      title: "Marigold Cotton Kurta",
    });
    expect(third.slug).toBe("marigold-cotton-kurta-3");

    // Same title in the OTHER catalogue doesn't need a suffix — slugs are
    // unique per catalogue, not globally.
    const otherCatalogue = await createProduct(db, admin, {
      catalog: "THRIFT",
      title: "Marigold Cotton Kurta",
    });
    expect(otherCatalogue.slug).toBe("marigold-cotton-kurta");
  });
});

describe("updateProduct", () => {
  it("enforces slug uniqueness on rename and rejects a cross-catalogue category", async () => {
    const a = await createProduct(db, admin, {
      catalog: "THRIFT",
      slug: "a-piece",
      title: "A",
    });
    await createProduct(db, admin, { catalog: "THRIFT", slug: "b-piece", title: "B" });

    await expect(
      updateProduct(db, admin, a.id, { slug: "b-piece" }),
    ).rejects.toBeInstanceOf(ValidationError);

    const tpeCat = await db.category.create({
      data: { catalog: "THE_POOJA_EDIT", slug: "kurtis", name: "Kurtis" },
    });
    await expect(
      updateProduct(db, admin, a.id, { categoryId: tpeCat.id }),
    ).rejects.toThrow(/different catalogue/i);
  });
});

describe("validateForPublication", () => {
  const base = {
    images: [{}],
    variants: [{ isActive: true, pricePaise: 1000, onHandQty: 1 }],
  };

  it("apparel needs an image and a priced active variant", () => {
    expect(
      validateForPublication({
        catalog: "THE_POOJA_EDIT",
        ...base,
        thriftDetails: null,
      }).ok,
    ).toBe(true);
    expect(
      validateForPublication({
        catalog: "THE_POOJA_EDIT",
        images: [],
        variants: [],
        thriftDetails: null,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "At least one image is required.",
        "At least one active, priced variant is required.",
      ]),
    );
  });

  it("thrift needs details, condition and >=1 measurement", () => {
    const res = validateForPublication({
      catalog: "THRIFT",
      ...base,
      thriftDetails: {
        conditionGrade: null,
        measurements: { _source: "x" },
        isOneOfOne: true,
      },
    });
    expect(res.ok).toBe(false);
    expect(res.errors).toEqual(
      expect.arrayContaining([
        "Condition grade is required for thrift.",
        "At least one measurement is required for thrift.",
      ]),
    );

    const ok = validateForPublication({
      catalog: "THRIFT",
      ...base,
      thriftDetails: {
        conditionGrade: "GOOD",
        measurements: { bust: { value: "34", unit: "in" } },
        isOneOfOne: true,
      },
    });
    expect(ok.ok).toBe(true);
  });

  it("rejects a one-of-one with total on-hand above 1", () => {
    const res = validateForPublication({
      catalog: "THRIFT",
      images: [{}],
      variants: [{ isActive: true, pricePaise: 1000, onHandQty: 2 }],
      thriftDetails: {
        conditionGrade: "GOOD",
        measurements: { bust: { value: "34" } },
        isOneOfOne: true,
      },
    });
    expect(res.errors.some((e) => /one-of-one/i.test(e))).toBe(true);
  });
});

describe("publishProduct", () => {
  it("blocks an incomplete product then publishes a ready one, audited", async () => {
    const p = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      slug: "kurta-x",
      title: "Kurta X",
    });
    await expect(publishProduct(db, admin, p.id)).rejects.toBeInstanceOf(
      ValidationError,
    );

    await upsertVariant(db, admin, p.id, {
      sku: `S-${randomUUID().slice(0, 6)}`,
      pricePaise: 149000,
      onHandQty: 5,
    });
    await db.productImage.create({
      data: {
        productId: p.id,
        bucket: "b",
        path: `p/${p.id}/0`,
        altText: "x",
        isPrimary: true,
      },
    });

    const published = await publishProduct(db, admin, p.id);
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();

    const log = await db.adminActivityLog.findFirst({
      where: { action: "product.publish" },
    });
    expect(log?.entityId).toBe(p.id);
  });
});

describe("upsertVariant — thrift one-of-one", () => {
  it("allows exactly one variant and caps on-hand at 1", async () => {
    const p = await createProduct(db, admin, {
      catalog: "THRIFT",
      slug: "scarf",
      title: "Scarf",
    });
    await upsertThriftDetails(db, admin, p.id, {
      conditionGrade: "GOOD",
      measurements: { length: { value: "60", unit: "in" } },
    });

    const v = await upsertVariant(db, admin, p.id, {
      sku: "THR-1",
      pricePaise: 50000,
      onHandQty: 1,
    });
    await expect(
      upsertVariant(db, admin, p.id, { sku: "THR-2", pricePaise: 50000, onHandQty: 1 }),
    ).rejects.toThrow(/single variant/i);
    await expect(
      upsertVariant(db, admin, p.id, {
        id: v.id,
        sku: "THR-1",
        pricePaise: 50000,
        onHandQty: 2,
      }),
    ).rejects.toThrow(/0 or 1/);
  });
});

// Owner feedback (2026-09-13): a Closet (one-of-one) piece has no size run
// to key a SKU off, so it's generated, not typed; Label keeps a real,
// required SKU.
describe("upsertVariant — SKU generation (owner feedback)", () => {
  it("generates a stable CLO-###### SKU for a Closet variant created with none", async () => {
    const p = await createProduct(db, admin, {
      catalog: "THRIFT",
      title: "Windcheater",
    });
    const created = await upsertVariant(db, admin, p.id, { pricePaise: 90000, onHandQty: 1 });
    expect(created.sku).toMatch(/^CLO-\d{6}$/);

    // Updating without a SKU keeps the one already generated — stable.
    const updated = await upsertVariant(db, admin, p.id, {
      id: created.id,
      pricePaise: 95000,
      onHandQty: 1,
    });
    expect(updated.sku).toBe(created.sku);
  });

  it("two Closet variants created back to back get different generated SKUs", async () => {
    const a = await createProduct(db, admin, { catalog: "THRIFT", title: "A" });
    const b = await createProduct(db, admin, { catalog: "THRIFT", title: "B" });
    const va = await upsertVariant(db, admin, a.id, { pricePaise: 10000, onHandQty: 1 });
    const vb = await upsertVariant(db, admin, b.id, { pricePaise: 10000, onHandQty: 1 });
    expect(va.sku).not.toBe(vb.sku);
  });

  it("a Label variant still requires an explicit SKU", async () => {
    const p = await createProduct(db, admin, { catalog: "THE_POOJA_EDIT", title: "Kurta" });
    await expect(
      upsertVariant(db, admin, p.id, { pricePaise: 199900, onHandQty: 5 }),
    ).rejects.toThrow(/sku is required/i);
  });
});

describe("collections never cross catalogues (AC-01)", () => {
  it("rejects adding a THE_POOJA_EDIT product to a THRIFT collection", async () => {
    const col = await createCollection(db, admin, {
      catalog: "THRIFT",
      slug: "summer",
      name: "Summer",
    });
    const thrProduct = await createProduct(db, admin, {
      catalog: "THRIFT",
      slug: "thr-1",
      title: "T",
    });
    const tpeProduct = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      slug: "tpe-1",
      title: "P",
    });

    await addProductToCollection(db, admin, col.id, thrProduct.id);
    await expect(
      addProductToCollection(db, admin, col.id, tpeProduct.id),
    ).rejects.toThrow(/cross catalogue|cross catalog/i);

    const members = await db.productCollection.findMany({
      where: { collectionId: col.id },
    });
    expect(members).toHaveLength(1);
    expect(members[0].position).toBe(0);
  });
});

/** A minimal published, in-stock product — the shape `getCollectionAdmin` /
 * `getHomeRailProducts` filter on. */
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

// Owner feedback (2026-09-13, Part B3) — admin collections screens.
describe("admin collections service", () => {
  it("auto-generates a collection slug from the name, suffixing -2/-3 on collision", async () => {
    const first = await createCollection(db, admin, { catalog: "THRIFT", name: "Autumn Edit" });
    expect(first.slug).toBe("autumn-edit");
    const second = await createCollection(db, admin, { catalog: "THRIFT", name: "Autumn Edit" });
    expect(second.slug).toBe("autumn-edit-2");
  });

  it("ensureHomeCollections creates both rails once and is idempotent", async () => {
    await ensureHomeCollections(db, admin);
    await ensureHomeCollections(db, admin);
    const rows = await db.collection.findMany({ where: { isInternal: true } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.slug).sort()).toEqual(["home-closet", "home-label"]);
    expect(rows.every((r) => r.catalog === "THE_POOJA_EDIT" || r.catalog === "THRIFT")).toBe(
      true,
    );
  });

  it("toggleFeatureOnHomePage inserts at position 0, shifting existing members down, and removing works", async () => {
    const a = await publishedProduct("THE_POOJA_EDIT", "A");
    const b = await publishedProduct("THE_POOJA_EDIT", "B");

    await toggleFeatureOnHomePage(db, admin, a.id, "THE_POOJA_EDIT");
    await toggleFeatureOnHomePage(db, admin, b.id, "THE_POOJA_EDIT");

    const col = await db.collection.findUniqueOrThrow({
      where: { catalog_slug: { catalog: "THE_POOJA_EDIT", slug: "home-label" } },
    });
    const members = await db.productCollection.findMany({
      where: { collectionId: col.id },
      orderBy: { position: "asc" },
    });
    // b was featured second, so it's at position 0 and a was pushed to 1.
    expect(members.map((m) => m.productId)).toEqual([b.id, a.id]);
    expect(members.map((m) => m.position)).toEqual([0, 1]);

    // Toggling an already-featured product removes it and renormalizes.
    await toggleFeatureOnHomePage(db, admin, b.id, "THE_POOJA_EDIT");
    const after = await db.productCollection.findMany({
      where: { collectionId: col.id },
      orderBy: { position: "asc" },
    });
    expect(after.map((m) => m.productId)).toEqual([a.id]);
    expect(after[0].position).toBe(0);
  });

  it("reorderCollectionProduct swaps neighbours and normalizes positions; a no-op at either end", async () => {
    const col = await createCollection(db, admin, { catalog: "THRIFT", name: "Order test" });
    const a = await publishedProduct("THRIFT", "OrderA");
    const b = await publishedProduct("THRIFT", "OrderB");
    const c = await publishedProduct("THRIFT", "OrderC");
    await addProductToCollection(db, admin, col.id, a.id);
    await addProductToCollection(db, admin, col.id, b.id);
    await addProductToCollection(db, admin, col.id, c.id);

    await reorderCollectionProduct(db, admin, col.id, b.id, "up");
    let rows = await db.productCollection.findMany({
      where: { collectionId: col.id },
      orderBy: { position: "asc" },
    });
    expect(rows.map((r) => r.productId)).toEqual([b.id, a.id, c.id]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);

    // Already first — moving "up" again is a no-op, not an error.
    await reorderCollectionProduct(db, admin, col.id, b.id, "up");
    rows = await db.productCollection.findMany({
      where: { collectionId: col.id },
      orderBy: { position: "asc" },
    });
    expect(rows.map((r) => r.productId)).toEqual([b.id, a.id, c.id]);
  });

  it("removeProductFromCollection renormalizes the remaining positions", async () => {
    const col = await createCollection(db, admin, { catalog: "THRIFT", name: "Remove test" });
    const a = await publishedProduct("THRIFT", "RemA");
    const b = await publishedProduct("THRIFT", "RemB");
    const c = await publishedProduct("THRIFT", "RemC");
    await addProductToCollection(db, admin, col.id, a.id);
    await addProductToCollection(db, admin, col.id, b.id);
    await addProductToCollection(db, admin, col.id, c.id);

    await removeProductFromCollection(db, admin, col.id, a.id);
    const rows = await db.productCollection.findMany({
      where: { collectionId: col.id },
      orderBy: { position: "asc" },
    });
    expect(rows.map((r) => r.productId)).toEqual([b.id, c.id]);
    expect(rows.map((r) => r.position)).toEqual([0, 1]); // no gap left by the deleted row
  });

  it("updateCollection ignores the active toggle for an internal collection", async () => {
    await ensureHomeCollections(db, admin);
    const home = await db.collection.findUniqueOrThrow({
      where: { catalog_slug: { catalog: "THE_POOJA_EDIT", slug: "home-label" } },
    });
    await updateCollection(db, admin, home.id, {
      name: "Renamed rail",
      isActive: false, // ignored — an internal collection's visibility is isInternal alone
    });
    const after = await db.collection.findUniqueOrThrow({ where: { id: home.id } });
    expect(after.name).toBe("Renamed rail");
    expect(after.isActive).toBe(true); // unchanged
  });

  it("searchAddableCollectionProducts excludes existing members, drafts, and the other catalogue", async () => {
    const col = await createCollection(db, admin, { catalog: "THRIFT", name: "Search test" });
    const already = await publishedProduct("THRIFT", "Search Already In");
    await addProductToCollection(db, admin, col.id, already.id);
    const findable = await publishedProduct("THRIFT", "Search Findable Item");
    const draft = await createProduct(db, admin, { catalog: "THRIFT", title: "Search Draft" });
    const otherCatalog = await publishedProduct("THE_POOJA_EDIT", "Search Other Catalogue");

    const results = await searchAddableCollectionProducts(db, col.id, "THRIFT", "search");
    const ids = results.map((r) => r.id);
    expect(ids).toContain(findable.id);
    expect(ids).not.toContain(already.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(otherCatalog.id);
  });

  it("listCollectionsAdmin and getCollectionAdmin report product counts and membership", async () => {
    const col = await createCollection(db, admin, { catalog: "THRIFT", name: "List test" });
    const p = await publishedProduct("THRIFT", "Listed piece");
    await addProductToCollection(db, admin, col.id, p.id);

    const list = await listCollectionsAdmin(db);
    const row = list.find((c) => c.id === col.id);
    expect(row?.productCount).toBe(1);
    expect(row?.isInternal).toBe(false);

    const detail = await getCollectionAdmin(db, col.id);
    expect(detail?.products).toHaveLength(1);
    expect(detail?.products[0].product.id).toBe(p.id);
  });
});

// Speed audit (2026-09-13): listAdminProducts moved from an exact
// db.product.count() to an over-fetch-by-one "hasMore" — this covers that
// the cheaper pagination still reports boundaries correctly, and that the
// list carries only the primary image (not the whole gallery).
describe("listAdminProducts pagination + primary image (speed audit)", () => {
  it("hasMore is false on the last page and true when there's another", async () => {
    for (let i = 0; i < 3; i++) {
      await createProduct(db, admin, {
        catalog: "THE_POOJA_EDIT",
        slug: `page-item-${i}`,
        title: `Page item ${i}`,
      });
    }
    const firstPage = await listAdminProducts(db, { take: 2, skip: 0 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);

    const secondPage = await listAdminProducts(db, { take: 2, skip: 2 });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.hasMore).toBe(false);
  });

  it("carries only the primary image, and null when there is none", async () => {
    const p = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      slug: "with-photo",
      title: "With photo",
    });
    await db.productImage.createMany({
      data: [
        {
          productId: p.id,
          bucket: "product-images",
          path: `${p.id}/gallery.jpg`,
          publicUrl: "https://example.invalid/gallery.jpg",
          altText: "gallery",
          isPrimary: false,
        },
        {
          productId: p.id,
          bucket: "product-images",
          path: `${p.id}/primary.jpg`,
          publicUrl: "https://example.invalid/primary.jpg",
          altText: "primary",
          isPrimary: true,
        },
      ],
    });
    const { items } = await listAdminProducts(db, { q: "with-photo" });
    expect(items[0].primaryImage).toEqual({
      publicUrl: "https://example.invalid/primary.jpg",
      altText: "primary",
    });
    expect(items[0].imageCount).toBe(2);

    const bare = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      slug: "no-photo",
      title: "No photo",
    });
    const { items: bareItems } = await listAdminProducts(db, { q: "no-photo" });
    expect(bareItems.find((i) => i.id === bare.id)?.primaryImage).toBeNull();
  });
});

// Owner feedback (2026-09-13): real delete only when the product has never
// appeared on an order — otherwise "Hide from shop" (archive) is the only
// option. Both paths covered.
describe("deleteProduct", () => {
  it("deletes a product that has never appeared on an order, removes its images from storage, and audits", async () => {
    const p = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      title: "Never sold",
    });
    await upsertVariant(db, admin, p.id, { sku: "NS-1", pricePaise: 50000, onHandQty: 3 });
    await db.productImage.create({
      data: {
        productId: p.id,
        bucket: "product-images",
        path: `${p.id}/photo.jpg`,
        publicUrl: "https://example.invalid/photo.jpg",
        altText: "photo",
        isPrimary: true,
      },
    });

    const storage = fakeStorage();
    await deleteProduct(db, storage, admin, p.id);

    expect(await db.product.findUnique({ where: { id: p.id } })).toBeNull();
    expect(await db.productVariant.findMany({ where: { productId: p.id } })).toHaveLength(0);
    expect(storage.deleted).toEqual([
      { bucket: "product-images", paths: [`${p.id}/photo.jpg`] },
    ]);
    const logs = await db.adminActivityLog.findMany({
      where: { action: "product.delete", entityId: p.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].adminUserId).toBe(admin.id);
  });

  it("refuses to delete a product with an order line, and leaves it untouched", async () => {
    const p = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      title: "Has an order",
    });
    const v = await upsertVariant(db, admin, p.id, {
      sku: "HO-1",
      pricePaise: 50000,
      onHandQty: 3,
    });
    const order = await db.order.create({
      data: {
        orderNumber: `PE-${randomUUID().slice(0, 10)}`,
        contactPhone: "+919812345678",
        paymentMethod: "PREPAID_RAZORPAY",
        subtotalPaise: 50000,
        totalPaise: 50000,
      },
    });
    await db.orderItem.create({
      data: {
        orderId: order.id,
        productId: p.id,
        variantId: v.id,
        catalog: "THE_POOJA_EDIT",
        sku: v.sku,
        title: p.title,
        quantity: 1,
        unitPricePaise: 50000,
        taxableValuePaise: 50000,
        totalPaise: 50000,
        returnPolicySnapshot: {},
      },
    });

    await expect(deleteProduct(db, fakeStorage(), admin, p.id)).rejects.toBeInstanceOf(
      ProductHasHistoryError,
    );
    expect(await db.product.findUnique({ where: { id: p.id } })).not.toBeNull();
  });

  it("refuses to delete a product whose variant has an inventory transaction (a correction, not just an order)", async () => {
    const p = await createProduct(db, admin, {
      catalog: "THE_POOJA_EDIT",
      title: "Stock corrected once",
    });
    const v = await upsertVariant(db, admin, p.id, {
      sku: "SC-1",
      pricePaise: 50000,
      onHandQty: 3,
    });
    await adjustStock(db, {
      variantId: v.id,
      delta: 2,
      reason: "recount",
      adminUserId: admin.id,
    });

    await expect(deleteProduct(db, fakeStorage(), admin, p.id)).rejects.toThrow(
      /on past orders/i,
    );
    expect(await db.product.findUnique({ where: { id: p.id } })).not.toBeNull();
  });
});

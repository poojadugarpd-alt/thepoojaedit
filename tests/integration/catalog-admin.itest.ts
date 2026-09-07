import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AdminUser, PrismaClient } from "../../src/generated/prisma";
import {
  ValidationError,
  addProductToCollection,
  createCollection,
  createProduct,
  publishProduct,
  updateProduct,
  upsertThriftDetails,
  upsertVariant,
  validateForPublication,
} from "../../src/server/catalog/admin";
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

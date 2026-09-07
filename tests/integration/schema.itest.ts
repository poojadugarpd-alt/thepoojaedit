import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
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

async function makeProduct(
  catalog: "THE_POOJA_EDIT" | "THRIFT",
  slug: string,
  overrides: Record<string, unknown> = {},
) {
  return db.product.create({
    data: { catalog, slug, title: slug, status: "DRAFT", ...overrides },
  });
}

describe("catalog / slug scoping (AC-01)", () => {
  it("allows the same slug in each catalog", async () => {
    await makeProduct("THE_POOJA_EDIT", "linen-set");
    await expect(makeProduct("THRIFT", "linen-set")).resolves.toBeDefined();
  });

  it("rejects a duplicate (catalog, slug)", async () => {
    await makeProduct("THRIFT", "denim-jacket");
    await expect(makeProduct("THRIFT", "denim-jacket")).rejects.toMatchObject({
      code: "P2002",
    });
  });
});

describe("category shared-slug uniqueness", () => {
  const cat = (catalog: "THE_POOJA_EDIT" | "THRIFT" | null, slug: string) =>
    db.category.create({ data: { catalog, slug, name: slug } });

  it("allows a global slug alongside a catalog-scoped one", async () => {
    await cat(null, "sale");
    await expect(cat("THRIFT", "sale")).resolves.toBeDefined();
  });

  it("rejects two global categories with the same slug", async () => {
    await cat(null, "new-in");
    await expect(cat(null, "new-in")).rejects.toThrow(/unique|duplicate/i);
  });

  it("rejects two same-catalog categories with the same slug", async () => {
    await cat("THRIFT", "outerwear");
    await expect(cat("THRIFT", "outerwear")).rejects.toThrow(/unique|duplicate/i);
  });

  it("allows the same slug in different catalogs", async () => {
    await cat("THRIFT", "tops");
    await expect(cat("THE_POOJA_EDIT", "tops")).resolves.toBeDefined();
  });
});

describe("inventory bounds (AC-05 foundation)", () => {
  it("rejects reservedQty > onHandQty", async () => {
    const p = await makeProduct("THE_POOJA_EDIT", "kurta");
    const v = await db.productVariant.create({
      data: { productId: p.id, sku: "K-1", pricePaise: 1000, onHandQty: 5 },
    });
    await expect(
      db.productVariant.update({
        where: { id: v.id },
        data: { reservedQty: 6 },
      }),
    ).rejects.toThrow(/reserved_le_onhand|check/i);
  });

  it("rejects negative on-hand", async () => {
    const p = await makeProduct("THE_POOJA_EDIT", "kurta2");
    const v = await db.productVariant.create({
      data: { productId: p.id, sku: "K-2", pricePaise: 1000, onHandQty: 1 },
    });
    await expect(
      db.productVariant.update({ where: { id: v.id }, data: { onHandQty: -1 } }),
    ).rejects.toThrow(/onhand_nonneg|check/i);
  });

  it("rejects a duplicate SKU", async () => {
    const p = await makeProduct("THE_POOJA_EDIT", "kurta3");
    await db.productVariant.create({
      data: { productId: p.id, sku: "DUP", pricePaise: 1000 },
    });
    await expect(
      db.productVariant.create({
        data: { productId: p.id, sku: "DUP", pricePaise: 1000 },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("thrift one-of-one physical limit (master §5)", () => {
  async function makeThrift(slug: string) {
    return db.product.create({
      data: {
        catalog: "THRIFT",
        slug,
        title: slug,
        status: "PUBLISHED",
        thriftDetails: {
          create: { conditionGrade: "GOOD", measurements: {}, isOneOfOne: true },
        },
      },
    });
  }

  it("rejects total on-hand > 1 across a one-of-one product's variants", async () => {
    const p = await makeThrift("scarf");
    await db.productVariant.create({
      data: { productId: p.id, sku: "S-A", pricePaise: 5000, onHandQty: 1 },
    });
    await expect(
      db.productVariant.create({
        data: { productId: p.id, sku: "S-B", pricePaise: 5000, onHandQty: 1 },
      }),
    ).rejects.toThrow(/one-of-one|check/i);
  });

  it("rejects bumping the single variant above 1", async () => {
    const p = await makeThrift("belt");
    const v = await db.productVariant.create({
      data: { productId: p.id, sku: "B-A", pricePaise: 5000, onHandQty: 1 },
    });
    await expect(
      db.productVariant.update({ where: { id: v.id }, data: { onHandQty: 2 } }),
    ).rejects.toThrow(/one-of-one|check/i);
  });
});

describe("order totals contract (AC-11 foundation)", () => {
  const base = {
    orderNumber: "IT-1",
    contactPhone: "+910000000000",
    paymentMethod: "PREPAID_RAZORPAY" as const,
    subtotalPaise: 10000,
    shippingPaise: 500,
    taxPaise: 525,
  };

  it("accepts a total that satisfies total = subtotal - discount + shipping + codFee + tax", async () => {
    await expect(
      db.order.create({ data: { ...base, totalPaise: 11025 } }),
    ).resolves.toBeDefined();
  });

  it("rejects a mismatched total", async () => {
    await expect(
      db.order.create({
        data: { ...base, orderNumber: "IT-2", totalPaise: 99999 },
      }),
    ).rejects.toThrow(/total_identity|check/i);
  });

  it("rejects a non-positive order-item quantity", async () => {
    const order = await db.order.create({
      data: { ...base, orderNumber: "IT-3", totalPaise: 11025 },
    });
    await expect(
      db.orderItem.create({
        data: {
          orderId: order.id,
          catalog: "THRIFT",
          sku: "X",
          title: "X",
          quantity: 0,
          unitPricePaise: 1000,
          taxableValuePaise: 1000,
          totalPaise: 1000,
          returnPolicySnapshot: {},
        },
      }),
    ).rejects.toThrow(/qty_pos|check/i);
  });
});

describe("financial-history protection", () => {
  it("blocks deleting a customer that has orders (onDelete: Restrict)", async () => {
    const customer = await db.customer.create({ data: { name: "Keep me" } });
    await db.order.create({
      data: {
        orderNumber: "IT-DEL",
        contactPhone: "+910000000001",
        paymentMethod: "COD",
        customerId: customer.id,
        subtotalPaise: 1000,
        totalPaise: 1000,
      },
    });
    await expect(db.customer.delete({ where: { id: customer.id } })).rejects.toThrow();
  });
});

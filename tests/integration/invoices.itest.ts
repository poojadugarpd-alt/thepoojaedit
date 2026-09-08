import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { placeOrder, type AddressInput } from "../../src/server/checkout/place-order";
import { InMemoryDocumentStore } from "../../src/lib/documents";
import { confirmCodOrder } from "../../src/server/orders/lifecycle";
import {
  createInvoiceForOrder,
  generateInvoicePdf,
  issueCreditNote,
} from "../../src/server/invoices/service";
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
  await db.storeSettings.create({
    data: {
      key: "business.profile",
      value: {
        legalName: "The Pooja Edit Pvt Ltd (fixture)",
        gstin: "08AAAAA0000A1Z5",
        stateName: "Rajasthan",
        stateCode: "08",
        addressLines: ["12 Studio Lane", "Jaipur 302001"],
        supportEmail: "help@example.invalid",
      },
    },
  });
  await db.storeSettings.create({
    data: { key: "checkout.rules", value: { reservationTtlSeconds: 600, codFeePaise: 3000 } },
  });
});

let seq = 0;
async function makeVariant(pricePaise = 149900) {
  const p = await db.product.create({
    data: {
      catalog: "THE_POOJA_EDIT",
      slug: `p-${++seq}-${randomUUID().slice(0, 6)}`,
      title: `Kurta ${seq}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      hsnCode: "6104",
      taxClass: {
        create: {
          code: `TC-${randomUUID().slice(0, 8)}`,
          name: "Standard test",
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
    },
  });
  const v = await db.productVariant.create({
    data: {
      productId: p.id,
      sku: `SKU-${randomUUID().slice(0, 8)}`,
      pricePaise,
      onHandQty: 10,
    },
  });
  return v.id;
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

async function confirmedCodOrder(variantId: string, quantity = 1) {
  const { order } = await placeOrder(db, {
    idempotencyKey: randomUUID(),
    scope: `guest:${randomUUID().slice(0, 12)}`,
    contact: { phone: "+919999900000", email: "buyer@example.invalid" },
    lines: [{ variantId, quantity }],
    paymentMethod: "COD",
    billing: addr(),
    shipping: addr(),
  });
  await confirmCodOrder(db, { orderId: order.id });
  return db.order.findUniqueOrThrow({ where: { id: order.id } });
}

describe("invoice numbering + identity (AC-11/12)", () => {
  it("simultaneous creation yields ONE invoice + one number; a retry reuses it", async () => {
    const v = await makeVariant();
    const order = await confirmedCodOrder(v, 2);

    const [a, b, c] = await Promise.all([
      createInvoiceForOrder(db, { orderId: order.id }),
      createInvoiceForOrder(db, { orderId: order.id }),
      createInvoiceForOrder(db, { orderId: order.id }),
    ]);
    expect(new Set([a.id, b.id, c.id]).size).toBe(1);
    expect(await db.invoice.count({ where: { orderId: order.id } })).toBe(1);

    const again = await createInvoiceForOrder(db, { orderId: order.id });
    expect(again.id).toBe(a.id);
    expect(again.number).toBe(a.number);
  });

  it("invoice numbers are sequential within a financial year / series", async () => {
    const v1 = await makeVariant();
    const v2 = await makeVariant();
    const o1 = await confirmedCodOrder(v1);
    const o2 = await confirmedCodOrder(v2);
    const i1 = await createInvoiceForOrder(db, { orderId: o1.id });
    const i2 = await createInvoiceForOrder(db, { orderId: o2.id });
    expect(i2.number).toBe(i1.number + 1);
    expect(i1.financialYear).toMatch(/^\d{4}-\d{2}$/);
  });

  it("financial year follows the order's confirmation date (Apr–Mar)", async () => {
    const v = await makeVariant();
    const order = await confirmedCodOrder(v);
    await db.order.update({
      where: { id: order.id },
      data: { confirmedAt: new Date("2026-03-15T00:00:00Z") },
    });
    const march = await createInvoiceForOrder(db, { orderId: order.id });
    expect(march.financialYear).toBe("2025-26");
  });
});

describe("invoice immutability + tax (AC-11)", () => {
  it("totals reconcile and a later price/tax edit does not change the snapshot", async () => {
    const v = await makeVariant(200000);
    const order = await confirmedCodOrder(v, 2);
    const invoice = await createInvoiceForOrder(db, { orderId: order.id });

    expect(invoice.totalPaise).toBe(order.totalPaise);
    const taxSnap = invoice.taxSnapshot as {
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      taxPaise: number;
      breakdownByRate: { taxableValuePaise: number; cgstPaise: number; sgstPaise: number }[];
    };
    expect(taxSnap.cgstPaise + taxSnap.sgstPaise + taxSnap.igstPaise).toBe(order.taxPaise);
    expect(taxSnap.taxPaise).toBe(order.taxPaise);
    const lineSnap = invoice.lineSnapshot as { totalPaise: number }[];
    const before = JSON.stringify(lineSnap);

    // edit the live product + variant + tax rule
    await db.productVariant.update({ where: { id: v }, data: { pricePaise: 999999 } });
    await db.product.update({
      where: { id: (await db.productVariant.findUniqueOrThrow({ where: { id: v } })).productId },
      data: { title: "RENAMED" },
    });

    const reread = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(JSON.stringify(reread.lineSnapshot)).toBe(before);
    expect(reread.totalPaise).toBe(order.totalPaise);
  });
});

describe("invoice PDF job (AC-11)", () => {
  it("is idempotent and repeatable — one object, same path", async () => {
    const store = new InMemoryDocumentStore();
    const v = await makeVariant();
    const order = await confirmedCodOrder(v);
    const invoice = await createInvoiceForOrder(db, { orderId: order.id });

    const first = await generateInvoicePdf(db, store, { invoiceId: invoice.id });
    expect(first.generated).toBe(true);
    expect(await store.exists(first.key)).toBe(true);
    const bytes = (await store.get(first.key))!.bytes;
    expect(Buffer.from(bytes.slice(0, 4)).toString()).toBe("%PDF");

    const second = await generateInvoicePdf(db, store, { invoiceId: invoice.id });
    expect(second.generated).toBe(false);
    expect(second.key).toBe(first.key);
  });

  it("a render failure opens an INVOICE_FAILURE task and never touches the order", async () => {
    const v = await makeVariant();
    const order = await confirmedCodOrder(v);
    const invoice = await createInvoiceForOrder(db, { orderId: order.id });
    const beforeStatus = order.orderStatus;

    const brokenStore = {
      async put() {
        throw new Error("storage down");
      },
      async get() {
        return null;
      },
      async exists() {
        return false;
      },
    };
    await expect(
      generateInvoicePdf(db, brokenStore, { invoiceId: invoice.id }),
    ).rejects.toThrow();
    expect(
      await db.operationalTask.count({
        where: { dedupeKey: `invoice-pdf:${invoice.id}`, status: "OPEN" },
      }),
    ).toBe(1);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).orderStatus,
    ).toBe(beforeStatus);
  });
});

describe("credit notes (AC-11/12)", () => {
  it("issued against the invoice, idempotent per refund, invoice untouched", async () => {
    const v = await makeVariant(100000);
    const order = await confirmedCodOrder(v);
    const invoice = await createInvoiceForOrder(db, { orderId: order.id });
    const invoiceBefore = JSON.stringify(invoice);
    const fakeRefundId = randomUUID();
    // a Refund row to reference (schema FK)
    await db.refund.create({
      data: {
        id: fakeRefundId,
        orderId: order.id,
        provider: "razorpay",
        amountPaise: 40000,
        status: "COMPLETED",
        operationKey: `r-${randomUUID().slice(0, 8)}`,
      },
    });

    const cn1 = await issueCreditNote(db, {
      invoiceId: invoice.id,
      refundId: fakeRefundId,
      reason: "REFUND",
      amountPaise: 40000,
    });
    const cn2 = await issueCreditNote(db, {
      invoiceId: invoice.id,
      refundId: fakeRefundId,
      reason: "REFUND",
      amountPaise: 40000,
    });
    expect(cn1.id).toBe(cn2.id);
    expect(cn1.number).toMatch(/^CN\//);
    expect(await db.creditNote.count({ where: { invoiceId: invoice.id } })).toBe(1);

    const invoiceAfter = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(JSON.stringify(invoiceAfter)).toBe(invoiceBefore);
  });
});

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderInvoicePdf } from "./pdf";

/**
 * Representative invoice PDFs — new apparel (intra-state CGST/SGST), thrift
 * one-of-one, mixed inter-state (IGST), and a DRAFT-watermarked fixture. The
 * bytes are written to a temp dir so a human can open them; the assertions are
 * the automated evidence (valid `%PDF`, non-trivial size, no encode crash).
 */
const OUT = mkdtempSync(join(tmpdir(), "poojaedit-invoices-"));

function base(over: {
  legal?: Record<string, unknown>;
  tax?: Record<string, unknown>;
  lines: unknown[];
  subtotalPaise?: number;
  discountPaise?: number;
  taxPaise?: number;
  totalPaise?: number;
}) {
  return {
    legalSnapshot: {
      seller: {
        legalName: "The Pooja Edit Pvt Ltd",
        gstin: "08AAAAA0000A1Z5",
        stateName: "Rajasthan",
        addressLines: ["12 Studio Lane", "Jaipur 302001"],
        supportEmail: "help@thepoojaedit.in",
      },
      invoiceNumber: "PE/2026-27/A/000007",
      issuedAt: "2026-09-08T10:00:00Z",
      orderNumber: "PE-260908-ABC123",
      paymentMethod: "PREPAID_RAZORPAY",
      isFixture: false,
      note: null,
      ...over.legal,
    },
    addressSnapshot: {
      billing: { name: "Asha R", line1: "9 Rose Villa", line2: "", landmark: "", city: "Jaipur", stateName: "Rajasthan", postcode: "302001", phone: "+919812345678" },
      shipping: { name: "Asha R", line1: "9 Rose Villa", line2: "", landmark: "", city: "Jaipur", stateName: "Rajasthan", postcode: "302001", phone: "+919812345678" },
    },
    taxSnapshot: { mode: "INCLUSIVE", interState: false, shippingPaise: 8000, codFeePaise: 0, ...over.tax },
    subtotalPaise: over.subtotalPaise ?? 250000,
    discountPaise: over.discountPaise ?? 0,
    taxPaise: over.taxPaise ?? 11905,
    totalPaise: over.totalPaise ?? 269905,
    lineSnapshot: over.lines,
  };
}

const SAMPLES: Record<string, ReturnType<typeof base>> = {
  "new-apparel": base({
    lines: [
      { sku: "TPE-KURTA-M", title: "Marigold Cotton Kurta", hsnCode: "6104", quantity: 1, unitPricePaise: 149900, taxableValuePaise: 142762, taxRateBps: 500, cgstPaise: 3569, sgstPaise: 3569, igstPaise: 0, totalPaise: 149900 },
      { sku: "TPE-SCARF", title: "Block-print Cotton Scarf", hsnCode: "6214", quantity: 1, unitPricePaise: 100000, taxableValuePaise: 95238, taxRateBps: 500, cgstPaise: 2381, sgstPaise: 2381, igstPaise: 0, totalPaise: 100000 },
    ],
  }),
  thrift: base({
    subtotalPaise: 249900,
    taxPaise: 11900,
    totalPaise: 269900,
    lines: [
      { sku: "THR-DENIM-001", title: "Vintage Denim Jacket (pre-loved, one-of-one)", hsnCode: "6201", quantity: 1, unitPricePaise: 249900, taxableValuePaise: 238000, taxRateBps: 500, cgstPaise: 5950, sgstPaise: 5950, igstPaise: 0, totalPaise: 249900 },
    ],
  }),
  "mixed-interstate-cod": base({
    tax: { interState: true, shippingPaise: 8000, codFeePaise: 3000 },
    legal: { paymentMethod: "COD" },
    subtotalPaise: 339900,
    taxPaise: 16186,
    totalPaise: 366900,
    lines: [
      { sku: "TPE-DRESS-L", title: "Tiered Linen Dress", hsnCode: "6104", quantity: 1, unitPricePaise: 239900, taxableValuePaise: 228476, taxRateBps: 500, cgstPaise: 0, sgstPaise: 0, igstPaise: 11424, totalPaise: 239900 },
      { sku: "THR-SILK-002", title: "Silk Scarf - Paisley (pre-loved)", hsnCode: "6214", quantity: 1, unitPricePaise: 100000, taxableValuePaise: 95238, taxRateBps: 500, cgstPaise: 0, sgstPaise: 0, igstPaise: 4762, totalPaise: 100000 },
    ],
  }),
  "fixture-draft": base({
    legal: { isFixture: true, note: "DRAFT / DEV FIXTURE - not a valid tax invoice." },
    lines: [
      { sku: "TPE-KURTA-M", title: "Marigold Cotton Kurta", hsnCode: "6104", quantity: 2, unitPricePaise: 149900, taxableValuePaise: 285524, taxRateBps: 500, cgstPaise: 7138, sgstPaise: 7138, igstPaise: 0, totalPaise: 299800 },
    ],
  }),
};

describe("renderInvoicePdf — representative samples", () => {
  it.each(Object.keys(SAMPLES))("renders a valid PDF: %s", async (name) => {
    const bytes = await renderInvoicePdf(
      SAMPLES[name] as Parameters<typeof renderInvoicePdf>[0],
    );
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1500);
    const path = join(OUT, `invoice-${name}.pdf`);
    writeFileSync(path, bytes);
    console.log(`  sample PDF: ${path} (${bytes.length} bytes)`);
  });

  it("a non-ASCII customer name does not crash the WinAnsi encoder", async () => {
    const withUnicode = base({
      legal: { seller: { legalName: "पूजा एडिट", gstin: null, stateName: "Delhi", addressLines: [], supportEmail: null } },
      lines: SAMPLES.thrift.lineSnapshot,
    });
    const bytes = await renderInvoicePdf(
      withUnicode as Parameters<typeof renderInvoicePdf>[0],
    );
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
  });
});

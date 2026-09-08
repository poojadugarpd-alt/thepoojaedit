import "server-only";

import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

/**
 * The standard PDF fonts use WinAnsi encoding, which has no `₹` glyph, so the
 * PDF renders amounts as `Rs 1,299.00`. (The storefront/emails use `formatPaiseINR`.)
 */
const inrDigits = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function money(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  return `${sign}Rs ${inrDigits.format(Math.abs(paise) / 100)}`;
}

/**
 * Render a one-page GST invoice PDF from the immutable invoice snapshots. Pure —
 * no DB, no network — so it is deterministic and unit-testable. A fixture /
 * unconfirmed-business invoice is watermarked DRAFT.
 */
interface Line {
  sku: string;
  title: string;
  hsnCode: string | null;
  quantity: number;
  unitPricePaise: number;
  taxableValuePaise: number;
  taxRateBps: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

export async function renderInvoicePdf(input: {
  legalSnapshot: Record<string, unknown>;
  addressSnapshot: Record<string, unknown>;
  lineSnapshot: unknown[];
  taxSnapshot: Record<string, unknown>;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
}): Promise<Uint8Array> {
  const legal = input.legalSnapshot as {
    seller: {
      legalName: string;
      gstin: string | null;
      stateName: string | null;
      addressLines: string[];
      supportEmail: string | null;
    };
    invoiceNumber: string;
    issuedAt: string;
    orderNumber: string;
    paymentMethod: string;
    isFixture: boolean;
    note: string | null;
  };
  const addresses = input.addressSnapshot as {
    billing: Record<string, string> | null;
    shipping: Record<string, string> | null;
  };
  const tax = input.taxSnapshot as { interState: boolean; shippingPaise: number; codFeePaise: number };
  const lines = input.lineSnapshot as Line[];

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 pt
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const M = 40;
  let y = height - M;

  // The standard fonts are WinAnsi-only; drop anything they cannot encode
  // rather than throwing on a stray non-Latin character in a name/address.
  const ascii = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {},
  ) => {
    page.drawText(ascii(s), {
      x,
      y: yy,
      size: opts.size ?? 9,
      font: opts.bold ? bold : font,
      color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])),
    });
  };

  if (legal.isFixture) {
    page.drawText("DRAFT", {
      x: 120,
      y: height / 2,
      size: 120,
      font: bold,
      color: rgb(0.92, 0.92, 0.92),
      rotate: degrees(30),
    });
  }

  text(legal.seller.legalName, M, y, { size: 14, bold: true });
  y -= 16;
  for (const l of legal.seller.addressLines.slice(0, 3)) {
    text(l, M, y);
    y -= 12;
  }
  if (legal.seller.gstin) {
    text(`GSTIN: ${legal.seller.gstin}`, M, y);
    y -= 12;
  }
  if (legal.seller.supportEmail) {
    text(legal.seller.supportEmail, M, y);
    y -= 12;
  }

  text("TAX INVOICE", width - M - 120, height - M, { size: 13, bold: true });
  text(legal.invoiceNumber, width - M - 200, height - M - 16, { size: 9 });
  text(`Date: ${legal.issuedAt.slice(0, 10)}`, width - M - 200, height - M - 28);
  text(`Order: ${legal.orderNumber}`, width - M - 200, height - M - 40);
  text(`Payment: ${legal.paymentMethod}`, width - M - 200, height - M - 52);

  y -= 12;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.7 });
  y -= 16;

  const addrBlock = (label: string, a: Record<string, string> | null, x: number) => {
    text(label, x, y, { bold: true });
    let yy = y - 12;
    if (a) {
      for (const part of [
        a.name,
        a.line1,
        [a.line2, a.landmark].filter(Boolean).join(", "),
        `${a.city}, ${a.stateName} ${a.postcode}`,
        a.phone,
      ].filter(Boolean)) {
        text(String(part), x, yy);
        yy -= 12;
      }
    }
    return yy;
  };
  const afterBilling = addrBlock("Bill to", addresses.billing, M);
  const afterShipping = addrBlock("Ship to", addresses.shipping, width / 2);
  y = Math.min(afterBilling, afterShipping) - 10;

  // table header
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.7 });
  y -= 12;
  const cols = tax.interState
    ? [M, 200, 250, 290, 350, 420, width - M - 70]
    : [M, 200, 245, 285, 340, 400, 460, width - M - 60];
  const headers = tax.interState
    ? ["Item", "HSN", "Qty", "Rate", "Taxable", "IGST", "Total"]
    : ["Item", "HSN", "Qty", "Rate", "Taxable", "CGST", "SGST", "Total"];
  headers.forEach((h, i) => text(h, cols[i], y, { bold: true, size: 8 }));
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.4 });
  y -= 12;

  for (const l of lines) {
    const asciiTitle = l.title.replace(/[^\x20-\x7E]/g, "");
    const title = asciiTitle.length > 26 ? `${asciiTitle.slice(0, 24)}...` : asciiTitle;
    const cells = tax.interState
      ? [
          title,
          l.hsnCode ?? "-",
          String(l.quantity),
          `${(l.taxRateBps / 100).toFixed(2)}%`,
          money(l.taxableValuePaise),
          money(l.igstPaise),
          money(l.totalPaise),
        ]
      : [
          title,
          l.hsnCode ?? "-",
          String(l.quantity),
          `${(l.taxRateBps / 100).toFixed(2)}%`,
          money(l.taxableValuePaise),
          money(l.cgstPaise),
          money(l.sgstPaise),
          money(l.totalPaise),
        ];
    cells.forEach((c, i) => text(c, cols[i], y, { size: 8 }));
    y -= 13;
  }

  y -= 4;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.4 });
  y -= 14;
  const totalsX = width - M - 200;
  const totRow = (label: string, value: number, isBold = false) => {
    text(label, totalsX, y, { bold: isBold });
    text(money(value), width - M - 60, y, { bold: isBold });
    y -= 13;
  };
  totRow("Subtotal", input.subtotalPaise);
  if (input.discountPaise > 0) totRow("Discount", -input.discountPaise);
  if (tax.shippingPaise > 0) totRow("Shipping", tax.shippingPaise);
  if (tax.codFeePaise > 0) totRow("COD fee", tax.codFeePaise);
  totRow("Tax", input.taxPaise);
  y -= 2;
  totRow("Total", input.totalPaise, true);

  y -= 20;
  if (legal.note) text(legal.note, M, y, { size: 7, color: [0.5, 0.1, 0.1] });
  text(
    "Computer-generated document. Amounts in INR.",
    M,
    M,
    { size: 7, color: [0.5, 0.5, 0.5] },
  );

  return doc.save();
}

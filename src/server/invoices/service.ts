import "server-only";

import type { CreditNote, Invoice, PrismaClient } from "@/generated/prisma";
import { DOCUMENTS_BUCKET, type DocumentStore } from "@/lib/documents";
import { openOperationalTask, resolveOperationalTask } from "@/server/events/operational-tasks";
import { appendOrderTimeline } from "@/server/orders/timeline";
import { getBusinessProfile } from "@/server/settings";

import { allocateInvoiceNumber, financialYearFor } from "./numbering";
import { renderInvoicePdf } from "./pdf";
import { buildInvoiceSnapshots } from "./snapshots";

export class InvoiceError extends Error {}

const SERIES = "A";
const isP2002 = (e: unknown) => (e as { code?: string })?.code === "P2002";

function invoicePdfKey(inv: {
  financialYear: string;
  series: string;
  number: number;
}): string {
  return `invoices/${inv.financialYear}/${inv.series}-${String(inv.number).padStart(6, "0")}.pdf`;
}

/**
 * Issue the (single, immutable) invoice for an order — master §6. Idempotent:
 * `Invoice @@unique([orderId])`. Concurrent callers race on that constraint;
 * the loser's transaction rolls back (including its sequence increment, so no
 * number gap) and it returns the winner's invoice.
 */
export async function createInvoiceForOrder(
  db: PrismaClient,
  input: { orderId: string; issuedAt?: Date },
): Promise<Invoice> {
  const pre = await db.invoice.findUnique({ where: { orderId: input.orderId } });
  if (pre) return pre;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const again = await tx.invoice.findUnique({ where: { orderId: input.orderId } });
        if (again) return again;

        const order = await tx.order.findUniqueOrThrow({
          where: { id: input.orderId },
          include: { items: { orderBy: { createdAt: "asc" } }, addresses: true },
        });
        if (order.orderStatus !== "CONFIRMED" && order.orderStatus !== "COMPLETED") {
          throw new InvoiceError(
            `Order ${order.orderNumber} is ${order.orderStatus}; an invoice needs a CONFIRMED order.`,
          );
        }

        const business = await getBusinessProfile(tx as unknown as PrismaClient);
        const issuedAt = input.issuedAt ?? new Date();
        const financialYear = financialYearFor(
          order.confirmedAt ?? order.placedAt ?? issuedAt,
        );
        const number = await allocateInvoiceNumber(tx, { financialYear, series: SERIES });
        const snaps = buildInvoiceSnapshots({
          order,
          items: order.items,
          addresses: order.addresses,
          business,
          financialYear,
          series: SERIES,
          number,
          issuedAt,
        });

        const invoice = await tx.invoice.create({
          data: {
            orderId: order.id,
            financialYear,
            series: SERIES,
            number,
            issuedAt,
            legalSnapshot: snaps.legalSnapshot as object,
            addressSnapshot: snaps.addressSnapshot as object,
            lineSnapshot: snaps.lineSnapshot as object,
            taxSnapshot: snaps.taxSnapshot as object,
            subtotalPaise: order.subtotalPaise,
            discountPaise: order.discountPaise,
            taxPaise: order.taxPaise,
            totalPaise: order.totalPaise,
          },
        });
        await appendOrderTimeline(tx, {
          orderId: order.id,
          type: "invoice.issued",
          payload: { invoiceId: invoice.id, number, financialYear },
        });
        return invoice;
      });
    } catch (e) {
      if (isP2002(e)) {
        const winner = await db.invoice.findUnique({ where: { orderId: input.orderId } });
        if (winner) return winner;
        continue;
      }
      throw e;
    }
  }
  throw new InvoiceError("Could not allocate an invoice after retries.");
}

/**
 * Generate the invoice PDF into private storage — idempotent, repeatable
 * (master §6). If the PDF already exists nothing is regenerated. A failure opens
 * an `INVOICE_FAILURE` task and re-throws (the Inngest step retries); it never
 * touches order or payment state.
 */
export async function generateInvoicePdf(
  db: PrismaClient,
  store: DocumentStore,
  input: { invoiceId: string },
): Promise<{ generated: boolean; key: string }> {
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
  const key = invoicePdfKey(invoice);

  if (invoice.pdfPath === key && (await store.exists(key))) {
    return { generated: false, key };
  }

  try {
    const bytes = await renderInvoicePdf({
      legalSnapshot: invoice.legalSnapshot as Record<string, unknown>,
      addressSnapshot: invoice.addressSnapshot as Record<string, unknown>,
      lineSnapshot: invoice.lineSnapshot as unknown[],
      taxSnapshot: invoice.taxSnapshot as Record<string, unknown>,
      subtotalPaise: invoice.subtotalPaise,
      discountPaise: invoice.discountPaise,
      taxPaise: invoice.taxPaise,
      totalPaise: invoice.totalPaise,
    });
    await store.put(key, bytes, "application/pdf");
    await db.invoice.update({
      where: { id: invoice.id },
      data: { pdfBucket: DOCUMENTS_BUCKET, pdfPath: key },
    });
    await resolveOperationalTask(db, `invoice-pdf:${invoice.id}`);
    return { generated: true, key };
  } catch (e) {
    await openOperationalTask(db, {
      dedupeKey: `invoice-pdf:${invoice.id}`,
      type: "INVOICE_FAILURE",
      entityType: "Invoice",
      entityId: invoice.id,
      priority: 1,
      reason: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

/**
 * Issue a credit note against an invoice (master §6 — corrections/refunds keep
 * the original invoice, use a credit note). Idempotent per `(invoiceId,
 * refundId)`; the number is derived under the invoice row lock.
 */
export async function issueCreditNote(
  db: PrismaClient,
  input: {
    invoiceId: string;
    refundId?: string | null;
    reason: "REFUND" | "RETURN" | "CANCELLATION" | "CORRECTION";
    amountPaise: number;
    note?: string;
  },
): Promise<CreditNote> {
  if (input.refundId) {
    const existing = await db.creditNote.findFirst({
      where: { invoiceId: input.invoiceId, refundId: input.refundId },
    });
    if (existing) return existing;
  }

  return db.$transaction(async (tx) => {
    const invoice = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "Invoice" WHERE id = $1::uuid FOR UPDATE`,
      input.invoiceId,
    );
    if (invoice.length === 0) throw new InvoiceError("Invoice not found.");
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });

    if (input.refundId) {
      const again = await tx.creditNote.findFirst({
        where: { invoiceId: input.invoiceId, refundId: input.refundId },
      });
      if (again) return again;
    }

    const seq = (await tx.creditNote.count({ where: { invoiceId: input.invoiceId } })) + 1;
    const number = `CN/${inv.financialYear}/${inv.series}${String(inv.number).padStart(6, "0")}-${seq}`;

    const taxSnap = inv.taxSnapshot as { interState?: boolean; mode?: string };
    // Proportional tax on the credited amount (inclusive extraction stays consistent).
    const ratio = inv.totalPaise > 0 ? input.amountPaise / inv.totalPaise : 0;
    const creditTaxPaise = Math.round(inv.taxPaise * ratio);

    const cn = await tx.creditNote.create({
      data: {
        invoiceId: input.invoiceId,
        refundId: input.refundId ?? null,
        number,
        reason: input.reason,
        adjustmentSnapshot: {
          amountPaise: input.amountPaise,
          reason: input.reason,
          note: input.note ?? null,
          againstInvoiceNumber: `PE/${inv.financialYear}/${inv.series}/${String(inv.number).padStart(6, "0")}`,
          issuedAt: new Date().toISOString(),
        },
        taxSnapshot: {
          mode: taxSnap.mode ?? "INCLUSIVE",
          interState: Boolean(taxSnap.interState),
          creditedTaxPaise: creditTaxPaise,
          creditedTaxableValuePaise: input.amountPaise - creditTaxPaise,
        },
      },
    });
    await appendOrderTimeline(tx, {
      orderId: inv.orderId,
      type: "credit_note.issued",
      payload: { creditNoteId: cn.id, number, amountPaise: input.amountPaise, reason: input.reason },
    });
    return cn;
  });
}

export { invoicePdfKey };

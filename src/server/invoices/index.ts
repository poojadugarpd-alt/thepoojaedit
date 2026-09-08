import "server-only";

/**
 * invoices domain service (master §6). Numbering + snapshots + PDF + credit
 * notes live in the sibling modules; this binds the shared Prisma client and
 * the configured document store.
 */
import { getDocumentStore } from "@/lib/documents";
import { prisma } from "@/lib/db";

import {
  createInvoiceForOrder,
  generateInvoicePdf,
  issueCreditNote,
} from "./service";

export * from "./numbering";
export {
  createInvoiceForOrder,
  generateInvoicePdf,
  issueCreditNote,
  InvoiceError,
  invoicePdfKey,
} from "./service";
export { buildInvoiceSnapshots } from "./snapshots";
export { renderInvoicePdf } from "./pdf";

export function issueInvoiceForOrder(orderId: string, issuedAt?: Date) {
  return createInvoiceForOrder(prisma, { orderId, issuedAt });
}

export async function renderAndStoreInvoicePdf(invoiceId: string) {
  const store = await getDocumentStore();
  return generateInvoicePdf(prisma, store, { invoiceId });
}

export function issueCreditNoteNow(input: {
  invoiceId: string;
  refundId?: string | null;
  reason: "REFUND" | "RETURN" | "CANCELLATION" | "CORRECTION";
  amountPaise: number;
  note?: string;
}) {
  return issueCreditNote(prisma, input);
}

/** Fetch the stored invoice PDF for an authorized caller. Returns null if absent. */
export async function loadInvoicePdf(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice?.pdfPath) return null;
  const store = await getDocumentStore();
  return store.get(invoice.pdfPath);
}

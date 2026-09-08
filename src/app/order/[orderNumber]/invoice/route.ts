import { NextResponse } from "next/server";

import { loadInvoicePdf } from "@/server/invoices";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/server/auth/current-customer";
import { ResourceNotFoundError } from "@/server/auth/errors";
import { getViewableOrderForCustomer, getViewableOrderForGuest } from "@/server/orders";

/**
 * Invoice PDF download (master §6, §9 — private document, authorized short-lived
 * access only). Access = the signed-in customer who owns the order, OR a valid
 * `ORDER_VIEW` token (`?token=`). No token + not owner → generic 404 (resist
 * enumeration). The PDF bytes come from the private document store.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  const { orderNumber } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? undefined;

  let order: Awaited<ReturnType<typeof getViewableOrderForGuest>> | null = null;
  try {
    if (token) {
      order = await getViewableOrderForGuest(orderNumber, token);
    } else {
      const customer = await getCurrentCustomer();
      if (customer) order = await getViewableOrderForCustomer(orderNumber, customer.id);
    }
  } catch (e) {
    if (!(e instanceof ResourceNotFoundError)) throw e;
  }
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });

  const invoice = await prisma.invoice.findUnique({ where: { orderId: order.id } });
  if (!invoice) {
    return NextResponse.json({ error: "invoice not ready" }, { status: 404 });
  }
  const pdf = await loadInvoicePdf(invoice.id);
  if (!pdf) return NextResponse.json({ error: "invoice not ready" }, { status: 404 });

  return new NextResponse(new Uint8Array(pdf.bytes), {
    status: 200,
    headers: {
      "Content-Type": pdf.contentType,
      "Content-Disposition": `inline; filename="invoice-${orderNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

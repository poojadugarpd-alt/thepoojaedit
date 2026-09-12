import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { AuthenticationError, AuthorizationError } from "@/server/auth/errors";
import { requireAdmin } from "@/server/auth/require-admin";
import { loadInvoicePdf } from "@/server/invoices";

/**
 * Admin invoice-PDF download. Distinct from the customer-facing
 * `/order/[orderNumber]/invoice` route (guest token / customer-ownership
 * only, no admin path) — that route is untouched. Admin-PWA audit decision
 * #1: the "invoice PDF" link on the admin order page pointed at the
 * customer route and 404'd for any admin who wasn't also the order's own
 * customer account. This route calls `requireAdmin()` independently, same
 * pattern as `/admin/shipments/[id]/label`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthenticationError) {
      return NextResponse.json({ error: "sign in" }, { status: 401 });
    }
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw e;
  }

  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true },
  });
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

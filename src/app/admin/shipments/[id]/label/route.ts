import { NextResponse } from "next/server";

import { AuthenticationError, AuthorizationError } from "@/server/auth/errors";
import { requireAdmin } from "@/server/auth/require-admin";
import { getShipmentLabelNow, isShippingConfigured } from "@/server/shipping";

/**
 * Shipping-label download (master §9 — "labels containing personal data use
 * private buckets and authorized short-lived downloads"). Every request
 * independently calls `requireAdmin()`; there is no reliance on route
 * middleware. When Supabase Storage is live the label bytes will be cached in a
 * private bucket, but the authorization boundary is this handler.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
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

  if (!isShippingConfigured()) {
    return NextResponse.json({ error: "shipping not configured" }, { status: 503 });
  }

  const { id } = await params;
  try {
    const label = await getShipmentLabelNow(id);
    return new NextResponse(new Uint8Array(label.bytes), {
      status: 200,
      headers: {
        "Content-Type": label.contentType,
        "Content-Disposition": `inline; filename="label-${id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "label unavailable" }, { status: 502 });
  }
}

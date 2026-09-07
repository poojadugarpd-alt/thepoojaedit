import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isPrepaidConfigured, ingestRazorpayWebhook } from "@/server/payments";

/**
 * Razorpay webhook sink (master §8). The RAW request bytes are what gets its
 * HMAC checked — never a re-serialised body — so we read an ArrayBuffer and hand
 * the exact Buffer to the verifier. The event is durably stored and deduped
 * before this handler acknowledges it; a persistence or processing failure
 * returns 5xx so Razorpay redelivers.
 *
 * Register this URL + the signing secret in the Razorpay dashboard
 * (Settings → Webhooks). Path is also listed in docs/integration-setup.md.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!isPrepaidConfigured()) {
    // No keys in this environment — nothing can be verified. Tell Razorpay to
    // stop (200) rather than retry forever against a disabled endpoint.
    return NextResponse.json({ error: "payments not configured" }, { status: 200 });
  }

  const rawBody = Buffer.from(await req.arrayBuffer());

  try {
    const { httpStatus, body } = await ingestRazorpayWebhook({
      rawBody,
      headers: req.headers,
    });
    return NextResponse.json(body, { status: httpStatus });
  } catch (e) {
    logger.error(
      { err: e instanceof Error ? e.message : String(e) },
      "razorpay webhook handler crashed",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

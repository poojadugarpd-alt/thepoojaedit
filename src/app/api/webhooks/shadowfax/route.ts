import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { ingestShadowfaxWebhook, isShippingConfigured } from "@/server/shipping";

/**
 * Shadowfax tracking callback sink (master §8, v1.1).
 *
 * Shadowfax callback authentication is weak or absent — at most a static token
 * the account may echo. This route persists + dedupes the raw callback, then
 * IGNORES its claimed status and re-reads the authenticated tracking API before
 * changing any state. A persistence/processing failure returns 5xx so Shadowfax
 * redelivers. Register this URL in the Shadowfax merchant panel; see
 * docs/integration-setup.md.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!isShippingConfigured()) {
    return NextResponse.json({ error: "shipping not configured" }, { status: 200 });
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  try {
    const { httpStatus, body } = await ingestShadowfaxWebhook({
      rawBody,
      headers: req.headers,
    });
    return NextResponse.json(body, { status: httpStatus });
  } catch (e) {
    logger.error(
      { err: e instanceof Error ? e.message : String(e) },
      "shadowfax webhook handler crashed",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { applyDeliveryCallbackNow } from "@/server/notifications";

/**
 * Meta WhatsApp Cloud API webhook (master §8).
 *  - GET  = Meta's verification handshake (`hub.verify_token` must match
 *           `WHATSAPP_VERIFY_TOKEN`).
 *  - POST = message status callbacks; the raw body is HMAC-SHA256 verified
 *           against `META_APP_SECRET` (`X-Hub-Signature-256: sha256=…`).
 * Status callbacks only advance a delivery forward — a stale one cannot undo a
 * delivered/read state (handled in `applyDeliveryCallback`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (
    mode === "subscribe" &&
    env.WHATSAPP_VERIFY_TOKEN &&
    token === env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

function verifySignature(rawBody: Buffer, header: string | null): boolean {
  if (!env.META_APP_SECRET || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", env.META_APP_SECRET).update(rawBody).digest("hex");
  const got = header.slice("sha256=".length);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}

const STATUS_MAP: Record<string, "sent" | "delivered" | "read" | "failed"> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

export async function POST(req: Request): Promise<Response> {
  const rawBody = Buffer.from(await req.arrayBuffer());
  if (!verifySignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: {
    entry?: {
      changes?: { value?: { statuses?: { id?: string; status?: string; timestamp?: string }[] } }[];
    }[];
  };
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const statuses =
    body.entry?.flatMap(
      (e) => e.changes?.flatMap((c) => c.value?.statuses ?? []) ?? [],
    ) ?? [];

  for (const s of statuses) {
    const mapped = STATUS_MAP[s.status ?? ""];
    if (!s.id || !mapped) continue;
    try {
      await applyDeliveryCallbackNow({
        providerMessageId: s.id,
        status: mapped,
        occurredAt: s.timestamp ? new Date(Number(s.timestamp) * 1000) : undefined,
      });
    } catch (e) {
      logger.error({ err: String(e) }, "whatsapp status callback failed");
    }
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

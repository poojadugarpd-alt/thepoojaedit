import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { applyDeliveryCallbackNow } from "@/server/notifications";

/**
 * Resend delivery webhook (master §8). Resend signs with Svix: the signature is
 * `HMAC-SHA256(base64secret, "<svix-id>.<svix-timestamp>.<rawBody>")`, base64,
 * and `svix-signature` holds one or more space-separated `v1,<sig>` values.
 * Without `RESEND_WEBHOOK_SECRET` the endpoint 401s (never trusts an unsigned
 * callback). Forward-only status advance is enforced downstream.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySvix(rawBody: string, headers: Headers): boolean {
  const secret = env.RESEND_WEBHOOK_SECRET;
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!secret || !id || !ts || !sigHeader) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest("base64");
  const expectedBuf = Buffer.from(expected);

  return sigHeader.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig || sig.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(sig), expectedBuf);
    } catch {
      return false;
    }
  });
}

const TYPE_MAP: Record<string, "sent" | "delivered" | "read" | "failed"> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "read",
  "email.bounced": "failed",
  "email.delivery_delayed": "sent",
  "email.complained": "failed",
};

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  if (!verifySvix(rawBody, req.headers)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: { type?: string; data?: { email_id?: string; created_at?: string } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const mapped = TYPE_MAP[body.type ?? ""];
  const messageId = body.data?.email_id;
  if (mapped && messageId) {
    try {
      await applyDeliveryCallbackNow({
        providerMessageId: messageId,
        status: mapped,
        occurredAt: body.data?.created_at ? new Date(body.data.created_at) : undefined,
      });
    } catch (e) {
      logger.error({ err: String(e) }, "resend status callback failed");
    }
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

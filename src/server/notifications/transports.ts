import "server-only";

import type { PrismaClient } from "@/generated/prisma";
import { env } from "@/lib/env";
import { publicEnv } from "@/lib/public-env";

import { sendAdminPush, type PushPreferenceField } from "./push";

/**
 * Notification transports (master §8). Each returns a provider message id on
 * acceptance — which is NOT proof of delivery; only a status callback advances a
 * delivery to DELIVERED. A transport throwing is a channel failure and must not
 * propagate into order/payment flow.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}
export interface WhatsAppMessage {
  to: string;
  templateName: string;
  bodyParams: string[];
  text: string;
}
export interface InAppMessage {
  entityType: string;
  entityId: string;
  type: string;
  title: string;
  message: string;
  priority: number;
}

export interface SendResult {
  providerMessageId: string | null;
}

export interface EmailTransport {
  readonly name: string;
  readonly configured: boolean;
  send(msg: EmailMessage): Promise<SendResult>;
}
export interface WhatsAppTransport {
  readonly name: string;
  readonly configured: boolean;
  send(msg: WhatsAppMessage): Promise<SendResult>;
}
export interface InAppTransport {
  send(msg: InAppMessage): Promise<SendResult>;
}

export interface Transports {
  email: EmailTransport;
  whatsapp: WhatsAppTransport;
  inApp: InAppTransport;
}

// ── live: Resend (REST, no SDK) ────────────────────────────────────────────
export function resendEmailTransport(): EmailTransport {
  return {
    name: "resend",
    configured: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    async send(msg) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        }),
      });
      if (!res.ok) {
        throw new Error(`resend ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as { id?: string };
      return { providerMessageId: json.id ?? null };
    },
  };
}

// ── live: Meta WhatsApp Cloud API (Graph REST) ────────────────────────────
export function metaWhatsAppTransport(): WhatsAppTransport {
  return {
    name: "meta_whatsapp",
    configured: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
    async send(msg) {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: msg.to.replace(/\D/g, ""),
            type: "template",
            template: {
              name: msg.templateName,
              language: { code: "en" },
              components: msg.bodyParams.length
                ? [
                    {
                      type: "body",
                      parameters: msg.bodyParams.map((t) => ({ type: "text", text: t })),
                    },
                  ]
                : [],
            },
          }),
        },
      );
      if (!res.ok) throw new Error(`whatsapp ${res.status}: ${await res.text()}`);
      const json = (await res.json()) as { messages?: { id?: string }[] };
      return { providerMessageId: json.messages?.[0]?.id ?? null };
    },
  };
}

// Only the two "good/needs-a-reply-soon" in-app types that have no
// corresponding OperationalTask push it to a phone (admin PWA Stage 4) — the
// NDR / shipment-failure / low-stock / payment-review / job-failure
// categories are pushed from `openOperationalTask` instead (below), from the
// same real occurrence that also opens the task. Pushing from both places
// would double-notify the same event.
const IN_APP_PUSH_PREFERENCE: Partial<Record<string, PushPreferenceField>> = {
  NEW_ORDER: "newPaidOrder",
  PENDING_COD: "codConfirmation",
};

// ── always-on: in-app admin notifications ─────────────────────────────────
export function dbInAppTransport(db: PrismaClient): InAppTransport {
  return {
    async send(msg) {
      const row = await db.adminNotification.create({
        data: {
          entityType: msg.entityType,
          entityId: msg.entityId,
          type: msg.type,
          title: msg.title,
          message: msg.message,
          priority: msg.priority,
        },
      });

      const preferenceField = IN_APP_PUSH_PREFERENCE[msg.type];
      if (preferenceField) {
        // The in-app row above is already committed — a push hiccup (a DB
        // blip inside sendAdminPush, say) must never turn a successful
        // in-app delivery into a reported failure.
        await sendAdminPush(db, {
          dedupeKey: `admin-notification:${row.id}`,
          preferenceField,
          title: msg.title,
          body: msg.message,
          path: msg.entityType === "Order" ? `/admin/orders?q=${msg.entityId}` : "/admin",
        }).catch(() => {});
      }

      return { providerMessageId: row.id };
    },
  };
}

// ── dev/unconfigured: record-only, never sends ───────────────────────────
export function noopEmailTransport(): EmailTransport {
  return {
    name: "noop-email",
    configured: false,
    async send() {
      // Not configured — the service treats this as "channel unavailable" and
      // skips before calling send, so this is only a safety net.
      throw new Error("email transport not configured");
    },
  };
}
export function noopWhatsAppTransport(): WhatsAppTransport {
  return {
    name: "noop-whatsapp",
    configured: false,
    async send() {
      throw new Error("whatsapp transport not configured");
    },
  };
}

export function getTransports(db: PrismaClient): Transports {
  const email = resendEmailTransport();
  const whatsapp = metaWhatsAppTransport();
  return {
    email: email.configured ? email : noopEmailTransport(),
    whatsapp: whatsapp.configured ? whatsapp : noopWhatsAppTransport(),
    inApp: dbInAppTransport(db),
  };
}

/** Public site URL for links in messages. */
export function siteUrl(path: string): string {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

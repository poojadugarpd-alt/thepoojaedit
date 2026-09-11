import "server-only";

import { z } from "zod";

import { formatPaiseINR } from "@/lib/money";

/**
 * Versioned notification template registry (master §8). The code here is the
 * source of truth for a template's existence, version, variable schema and
 * rendering; a `NotificationTemplate` DB row is an optional per-store override
 * that can DISABLE a channel or carry a provider template id. SMS is absent by
 * design.
 *
 * Wording rules encoded: a COD order confirmation never says "paid" / "payment
 * successful"; confirmation, shipping, delivery, cancellation and refund each
 * have distinct copy.
 */

export type NotifChannel = "EMAIL" | "WHATSAPP" | "IN_APP";

export class TemplateVariableError extends Error {
  constructor(readonly key: string, readonly issues: string) {
    super(`Notification "${key}": invalid variables — ${issues}`);
    this.name = "TemplateVariableError";
  }
}

interface EmailRender {
  subject: string;
  html: string;
  text: string;
}
interface WhatsAppRender {
  /** Approved template name registered with Meta. */
  templateName: string;
  bodyParams: string[];
  /** Plain-text fallback for logs / the fake transport. */
  text: string;
}
interface InAppRender {
  type: string;
  title: string;
  message: string;
  priority: number;
}

interface TemplateDef<S extends z.ZodTypeAny> {
  version: number;
  schema: S;
  channels: NotifChannel[];
  email?: (v: z.infer<S>) => EmailRender;
  whatsapp?: (v: z.infer<S>) => WhatsAppRender;
  inApp?: (v: z.infer<S>) => InAppRender;
}

/** Preserves each template's own variable type (a loose `satisfies` would not). */
function defineTemplate<S extends z.ZodTypeAny>(def: TemplateDef<S>): TemplateDef<S> {
  return def;
}

const orderRef = z.object({
  orderNumber: z.string(),
  orderUrl: z.string().url().optional(),
});

function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#888">The Pooja Edit — by Pooja Dugar</p>
</body></html>`;
}

export const TEMPLATES = {
  order_confirmation_prepaid: defineTemplate({
    version: 1,
    channels: ["EMAIL", "WHATSAPP"],
    schema: orderRef.extend({
      totalPaise: z.number().int(),
      itemCount: z.number().int().positive(),
    }),
    email: (v) => ({
      subject: `Order ${v.orderNumber} confirmed`,
      text: `Payment received. Your order ${v.orderNumber} (${v.itemCount} item(s), ${formatPaiseINR(v.totalPaise)}) is confirmed and being prepared.${v.orderUrl ? ` Track it: ${v.orderUrl}` : ""}`,
      html: emailShell(
        `Order ${v.orderNumber} confirmed`,
        `<p>Thanks! Your payment of <strong>${formatPaiseINR(v.totalPaise)}</strong> was received and your order is confirmed.</p>
         <p>${v.itemCount} item(s). We'll email you the tracking link when it ships.</p>
         ${v.orderUrl ? `<p><a href="${v.orderUrl}">View your order</a></p>` : ""}`,
      ),
    }),
    whatsapp: (v) => ({
      templateName: "order_confirmed_prepaid",
      bodyParams: [v.orderNumber, formatPaiseINR(v.totalPaise)],
      text: `Your order ${v.orderNumber} is confirmed — ${formatPaiseINR(v.totalPaise)} received. We'll share tracking soon.`,
    }),
  }),

  order_confirmation_cod: defineTemplate({
    version: 1,
    channels: ["EMAIL", "WHATSAPP"],
    schema: orderRef.extend({
      totalPaise: z.number().int(),
      itemCount: z.number().int().positive(),
    }),
    email: (v) => ({
      subject: `Order ${v.orderNumber} received (Cash on Delivery)`,
      text: `We've received your Cash on Delivery order ${v.orderNumber} (${v.itemCount} item(s)). Please keep ${formatPaiseINR(v.totalPaise)} ready to pay the courier on delivery. This order is pending our confirmation.`,
      html: emailShell(
        `Order ${v.orderNumber} received`,
        `<p>We've received your <strong>Cash on Delivery</strong> order. It's pending our confirmation — we'll message you shortly.</p>
         <p>${v.itemCount} item(s). Please keep <strong>${formatPaiseINR(v.totalPaise)}</strong> ready to pay the delivery agent.</p>
         ${v.orderUrl ? `<p><a href="${v.orderUrl}">View your order</a></p>` : ""}`,
      ),
    }),
    whatsapp: (v) => ({
      templateName: "order_received_cod",
      bodyParams: [v.orderNumber, formatPaiseINR(v.totalPaise)],
      text: `Order ${v.orderNumber} received (Cash on Delivery). Keep ${formatPaiseINR(v.totalPaise)} ready for the courier. Pending confirmation.`,
    }),
  }),

  shipment_dispatched: defineTemplate({
    version: 1,
    channels: ["EMAIL", "WHATSAPP"],
    schema: orderRef.extend({
      awb: z.string().nullable(),
      courier: z.string().default("Shadowfax"),
      trackingUrl: z.string().url().nullable().optional(),
    }),
    email: (v) => ({
      subject: `Order ${v.orderNumber} shipped`,
      text: `Your order ${v.orderNumber} has shipped via ${v.courier}${v.awb ? ` (AWB ${v.awb})` : ""}.${v.trackingUrl ? ` Track: ${v.trackingUrl}` : ""}`,
      html: emailShell(
        `Order ${v.orderNumber} shipped`,
        `<p>Your order is on its way via <strong>${v.courier}</strong>${v.awb ? ` — AWB <strong>${v.awb}</strong>` : ""}.</p>
         ${v.trackingUrl ? `<p><a href="${v.trackingUrl}">Track your parcel</a></p>` : v.orderUrl ? `<p><a href="${v.orderUrl}">View your order</a></p>` : ""}`,
      ),
    }),
    whatsapp: (v) => ({
      templateName: "shipment_dispatched",
      bodyParams: [v.orderNumber, v.courier, v.awb ?? "—"],
      text: `Order ${v.orderNumber} shipped via ${v.courier}${v.awb ? `, AWB ${v.awb}` : ""}.`,
    }),
  }),

  shipment_out_for_delivery: defineTemplate({
    version: 1,
    channels: ["EMAIL", "WHATSAPP"],
    schema: orderRef.extend({
      trackingUrl: z.string().url().nullable().optional(),
    }),
    email: (v) => ({
      subject: `Order ${v.orderNumber} is out for delivery`,
      text: `Your order ${v.orderNumber} is out for delivery today.${v.trackingUrl ? ` Track: ${v.trackingUrl}` : ""}`,
      html: emailShell(
        `Out for delivery`,
        `<p>Your order <strong>${v.orderNumber}</strong> is out for delivery today. Please keep your phone reachable.</p>`,
      ),
    }),
    whatsapp: (v) => ({
      templateName: "out_for_delivery",
      bodyParams: [v.orderNumber],
      text: `Order ${v.orderNumber} is out for delivery today.`,
    }),
  }),

  order_delivered: defineTemplate({
    version: 1,
    channels: ["EMAIL", "WHATSAPP"],
    schema: orderRef,
    email: (v) => ({
      subject: `Order ${v.orderNumber} delivered`,
      text: `Your order ${v.orderNumber} has been delivered. We hope you love it!`,
      html: emailShell(
        `Delivered`,
        `<p>Your order <strong>${v.orderNumber}</strong> has been delivered. We hope you love it!</p>`,
      ),
    }),
    whatsapp: (v) => ({
      templateName: "order_delivered",
      bodyParams: [v.orderNumber],
      text: `Order ${v.orderNumber} delivered. Thank you!`,
    }),
  }),

  delivery_failed: defineTemplate({
    version: 1,
    channels: ["EMAIL", "WHATSAPP"],
    schema: orderRef.extend({
      reason: z.string().default("delivery could not be completed"),
      trackingUrl: z.string().url().nullable().optional(),
    }),
    email: (v) => ({
      subject: `Action needed: delivery of order ${v.orderNumber}`,
      text: `We couldn't deliver your order ${v.orderNumber} (${v.reason}). Please reply with a convenient time / corrected address, or contact support so we can re-attempt.`,
      html: emailShell(
        `Delivery needs your help`,
        `<p>We tried to deliver order <strong>${v.orderNumber}</strong> but couldn't (${v.reason}).</p>
         <p>Reply to this email with a good time to re-attempt or any address correction, and we'll arrange another delivery.</p>`,
      ),
    }),
    whatsapp: (v) => ({
      templateName: "delivery_failed",
      bodyParams: [v.orderNumber, v.reason],
      text: `We couldn't deliver order ${v.orderNumber} (${v.reason}). Reply with a good time / address fix to re-attempt.`,
    }),
  }),

  order_cancelled: defineTemplate({
    version: 1,
    channels: ["EMAIL", "WHATSAPP"],
    schema: orderRef.extend({ reason: z.string().default("as requested") }),
    email: (v) => ({
      subject: `Order ${v.orderNumber} cancelled`,
      text: `Your order ${v.orderNumber} has been cancelled (${v.reason}). Any eligible refund is processed separately and you'll be notified when it completes.`,
      html: emailShell(
        `Order ${v.orderNumber} cancelled`,
        `<p>Your order has been cancelled (${v.reason}).</p>
         <p>If a payment was made, the refund is handled separately — we'll email you when it completes.</p>`,
      ),
    }),
    whatsapp: (v) => ({
      templateName: "order_cancelled",
      bodyParams: [v.orderNumber],
      text: `Order ${v.orderNumber} cancelled (${v.reason}). Refund, if any, is processed separately.`,
    }),
  }),

  refund_completed: defineTemplate({
    version: 1,
    channels: ["EMAIL", "WHATSAPP"],
    schema: orderRef.extend({ amountPaise: z.number().int().positive() }),
    email: (v) => ({
      subject: `Refund completed for order ${v.orderNumber}`,
      text: `Your refund of ${formatPaiseINR(v.amountPaise)} for order ${v.orderNumber} has been completed. It may take a few working days to reflect in your account.`,
      html: emailShell(
        `Refund completed`,
        `<p>Your refund of <strong>${formatPaiseINR(v.amountPaise)}</strong> for order <strong>${v.orderNumber}</strong> is complete.</p>
         <p>It can take a few working days to appear on your statement.</p>`,
      ),
    }),
    whatsapp: (v) => ({
      templateName: "refund_completed",
      bodyParams: [v.orderNumber, formatPaiseINR(v.amountPaise)],
      text: `Refund of ${formatPaiseINR(v.amountPaise)} for order ${v.orderNumber} completed.`,
    }),
  }),

  admin_new_order: defineTemplate({
    version: 1,
    channels: ["IN_APP"],
    schema: orderRef.extend({ paymentMethod: z.string(), totalPaise: z.number().int() }),
    inApp: (v) => ({
      type: "NEW_ORDER",
      title: `New order ${v.orderNumber}`,
      message: `${v.paymentMethod} · ${formatPaiseINR(v.totalPaise)}`,
      priority: 1,
    }),
  }),
  admin_pending_cod: defineTemplate({
    version: 1,
    channels: ["IN_APP"],
    schema: orderRef.extend({ totalPaise: z.number().int() }),
    inApp: (v) => ({
      type: "PENDING_COD",
      title: `COD to confirm: ${v.orderNumber}`,
      message: `${formatPaiseINR(v.totalPaise)} — confirm with the customer`,
      priority: 2,
    }),
  }),
  admin_delivery_failed: defineTemplate({
    version: 1,
    channels: ["IN_APP"],
    schema: orderRef.extend({ reason: z.string() }),
    inApp: (v) => ({
      type: "NDR",
      title: `Delivery failed: ${v.orderNumber}`,
      message: v.reason,
      priority: 2,
    }),
  }),
};

export type TemplateKey = keyof typeof TEMPLATES;

export function templateVersion(key: TemplateKey): number {
  return TEMPLATES[key].version;
}

export function renderTemplate(
  key: TemplateKey,
  channel: NotifChannel,
  rawVars: unknown,
): EmailRender | WhatsAppRender | InAppRender {
  const def = TEMPLATES[key] as TemplateDef<z.ZodTypeAny>;
  if (!def.channels.includes(channel)) {
    throw new TemplateVariableError(key, `channel ${channel} not supported`);
  }
  const parsed = def.schema.safeParse(rawVars);
  if (!parsed.success) {
    throw new TemplateVariableError(
      key,
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  const v = parsed.data;
  if (channel === "EMAIL") {
    if (!def.email) throw new TemplateVariableError(key, "no email renderer");
    return def.email(v);
  }
  if (channel === "WHATSAPP") {
    if (!def.whatsapp) throw new TemplateVariableError(key, "no whatsapp renderer");
    return def.whatsapp(v);
  }
  if (!def.inApp) throw new TemplateVariableError(key, "no in-app renderer");
  return def.inApp(v);
}

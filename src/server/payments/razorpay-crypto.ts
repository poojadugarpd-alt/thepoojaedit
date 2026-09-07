import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  NormalizedPayment,
  NormalizedPaymentStatus,
  NormalizedRefund,
  NormalizedRefundStatus,
  VerifiedProviderWebhook,
} from "./port";

/**
 * Razorpay signature + payload normalisation — pure, no network, no database,
 * so it is exhaustively unit-testable. Razorpay documents raw-body HMAC-SHA256
 * verification for both the checkout handoff and webhooks:
 *   https://razorpay.com/docs/webhooks/validate-test/
 *   https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/#step-4-verify-payment-signature
 */

/** `HMAC_SHA256(order_id + "|" + payment_id, key_secret)`, hex. */
export function checkoutSignature(
  providerOrderId: string,
  providerPaymentId: string,
  keySecret: string,
): string {
  return createHmac("sha256", keySecret)
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest("hex");
}

/** `HMAC_SHA256(rawBody, webhookSecret)`, hex. */
export function webhookSignature(rawBody: Buffer, webhookSecret: string): string {
  return createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
}

/** Constant-time hex-string comparison. Unequal lengths / non-hex → false. */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyCheckoutSignature(input: {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  return safeEqualHex(
    checkoutSignature(input.providerOrderId, input.providerPaymentId, input.keySecret),
    input.signature,
  );
}

export function verifyWebhookSignature(input: {
  rawBody: Buffer;
  signature: string;
  webhookSecret: string;
}): boolean {
  return safeEqualHex(
    webhookSignature(input.rawBody, input.webhookSecret),
    input.signature,
  );
}

// ─────────────────────────── payload normalisation ───────────────────────────

interface RzpPaymentEntity {
  id: string;
  order_id?: string | null;
  status?: string;
  amount?: number;
  amount_refunded?: number;
  currency?: string;
  method?: string | null;
  captured?: boolean;
}

interface RzpRefundEntity {
  id: string;
  payment_id: string;
  status?: string;
  amount?: number;
}

const PAYMENT_STATUS: Record<string, NormalizedPaymentStatus> = {
  created: "created",
  authorized: "authorized",
  captured: "captured",
  refunded: "refunded",
  failed: "failed",
};

const REFUND_STATUS: Record<string, NormalizedRefundStatus> = {
  pending: "pending",
  processed: "processed",
  failed: "failed",
};

export function normalizeRazorpayPayment(entity: RzpPaymentEntity): NormalizedPayment {
  const status = PAYMENT_STATUS[entity.status ?? ""] ?? "created";
  const amountPaise = entity.amount ?? 0;
  return {
    providerPaymentId: entity.id,
    providerOrderId: entity.order_id ?? null,
    status,
    amountPaise,
    capturedAmountPaise: status === "captured" ? amountPaise : 0,
    amountRefundedPaise: entity.amount_refunded ?? 0,
    currency: entity.currency ?? "INR",
    method: entity.method ?? null,
    raw: entity,
  };
}

export function normalizeRazorpayRefund(entity: RzpRefundEntity): NormalizedRefund {
  return {
    providerRefundId: entity.id,
    providerPaymentId: entity.payment_id,
    status: REFUND_STATUS[entity.status ?? ""] ?? "pending",
    amountPaise: entity.amount ?? 0,
    raw: entity,
  };
}

/**
 * Parse a verified Razorpay webhook body into our normalised shape. `eventId`
 * is the `x-razorpay-event-id` header when present (stable), else the sha256 of
 * the raw body (still stable per redelivery of the same bytes).
 */
export function parseRazorpayWebhookBody(
  body: unknown,
  eventId: string,
): VerifiedProviderWebhook {
  const b = (body ?? {}) as {
    event?: string;
    payload?: {
      payment?: { entity?: RzpPaymentEntity };
      refund?: { entity?: RzpRefundEntity };
    };
  };
  const eventType = b.event ?? "unknown";
  const paymentEntity = b.payload?.payment?.entity;
  const refundEntity = b.payload?.refund?.entity;
  return {
    externalEventId: eventId,
    eventType,
    payment: paymentEntity ? normalizeRazorpayPayment(paymentEntity) : undefined,
    refund: refundEntity ? normalizeRazorpayRefund(refundEntity) : undefined,
    raw: body,
  };
}

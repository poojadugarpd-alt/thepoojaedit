import "server-only";

import { isProduction } from "@/lib/app-env";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

import { ShippingNotConfiguredError, type ShippingProvider } from "./port";
import { ShadowfaxProvider } from "./shadowfax";
import {
  createShipmentForOrder,
  ensureShipmentForConfirmedOrder,
  getShipmentLabel,
  handleShadowfaxWebhook,
  inspectRtoReturn,
  reconcileShipment,
  syncCodRemittance,
  type RtoOutcome,
} from "./service";

/**
 * Shipping boundary (master §2, §8 — v1.1: Shadowfax).
 *
 * Phase 5 shipped a quote-only `ShippingPort` + a deterministic
 * `TestShippingAdapter`. Phase 8 adds the fulfilment surface behind a
 * provider-neutral `ShippingProvider` (./port), the Shadowfax adapter
 * (./shadowfax) and the orchestration (./service). Provider calls always happen
 * OUTSIDE database transactions.
 */

export interface ShippingQuoteRequest {
  destinationPostcode: string;
  items: { weightGrams: number; quantity: number }[];
  paymentMethod: "PREPAID_RAZORPAY" | "COD";
  orderValuePaise: number;
}

export interface ShippingQuote {
  serviceable: boolean;
  shippingPaise: number;
  codAllowed: boolean;
  codFeePaise: number;
  /** Estimated delivery time from the carrier, in days, when known. */
  etaDays?: number;
  /** Present only for the test adapter, so it can never be mistaken for real. */
  testAdapter?: true;
  reason?: string;
}

export interface ShippingPort {
  quote(req: ShippingQuoteRequest): Promise<ShippingQuote>;
}

/** Deterministic dev/test adapter. Not a real carrier. */
export class TestShippingAdapter implements ShippingPort {
  constructor(
    private readonly opts: {
      flatShippingPaise?: number;
      codFeePaise?: number;
      nonServiceablePostcodes?: string[];
      codDisallowedPostcodes?: string[];
      codMaxOrderValuePaise?: number;
      freeShippingThresholdPaise?: number;
    } = {},
  ) {}

  async quote(req: ShippingQuoteRequest): Promise<ShippingQuote> {
    const nonServiceable = this.opts.nonServiceablePostcodes ?? ["000000", "999999"];
    if (nonServiceable.includes(req.destinationPostcode)) {
      return {
        serviceable: false,
        shippingPaise: 0,
        codAllowed: false,
        codFeePaise: 0,
        testAdapter: true,
        reason: "postcode not serviceable (test adapter)",
      };
    }

    const flat = this.opts.flatShippingPaise ?? 10_000; // ₹100
    const freeThreshold = this.opts.freeShippingThresholdPaise ?? Infinity;
    const shippingPaise = req.orderValuePaise >= freeThreshold ? 0 : flat;

    const codDisallowed = this.opts.codDisallowedPostcodes ?? [];
    const codMax = this.opts.codMaxOrderValuePaise ?? 2_000_000; // ₹20,000
    const codAllowed =
      req.paymentMethod === "COD"
        ? !codDisallowed.includes(req.destinationPostcode) &&
          req.orderValuePaise <= codMax
        : true;

    return {
      serviceable: true,
      shippingPaise,
      codAllowed,
      codFeePaise: req.paymentMethod === "COD" ? (this.opts.codFeePaise ?? 3_000) : 0,
      testAdapter: true,
    };
  }
}

// ─────────────────────── Phase 8: provider + wrappers ─────────────────────

export * from "./port";
export {
  normalizeShadowfaxStatus,
  isShipmentOpen,
  SHIPMENT_TERMINAL,
  eventFingerprint,
} from "./status";
export {
  applyTrackingEvent,
  createShipmentForOrder,
  ensureShipmentForConfirmedOrder,
  getShipmentLabel,
  handleShadowfaxWebhook,
  inspectRtoReturn,
  makeShipmentReconcilePort,
  reconcileShipment,
  syncCodRemittance,
} from "./service";
export type { RtoOutcome } from "./service";

/** True when Shadowfax fulfilment can actually run in this environment. */
export function isShippingConfigured(): boolean {
  return Boolean(env.SHADOWFAX_API_TOKEN);
}

let cachedProvider: ShippingProvider | null = null;

/** The configured Shadowfax provider, or throw if credentials are absent. */
export function getFulfilmentProvider(): ShippingProvider {
  if (cachedProvider) return cachedProvider;
  if (!isShippingConfigured()) throw new ShippingNotConfiguredError();
  cachedProvider = new ShadowfaxProvider({
    apiToken: env.SHADOWFAX_API_TOKEN!,
    webhookToken: env.SHADOWFAX_WEBHOOK_TOKEN ?? null,
    // APP_ENV, not NODE_ENV — a local/preview build must never call Shadowfax's
    // production API by accident.
    environment: isProduction ? "production" : "staging",
    apiBase: env.SHADOWFAX_API_BASE ?? undefined,
  });
  return cachedProvider;
}

/**
 * Provider for the checkout QUOTE only. Uses Shadowfax when configured, else the
 * deterministic `TestShippingAdapter` so local/dev checkout still prices.
 */
export function getQuoteProvider(): ShippingPort {
  return isShippingConfigured() ? getFulfilmentProvider() : new TestShippingAdapter();
}

// Prisma-bound wrappers for routes / actions / jobs.
export function createShipmentForOrderNow(orderId: string, actor?: string) {
  return createShipmentForOrder(prisma, getFulfilmentProvider(), { orderId, actor });
}
export function ensureShipmentNow(orderId: string) {
  return ensureShipmentForConfirmedOrder(prisma, getFulfilmentProvider(), { orderId });
}
export function ingestShadowfaxWebhook(input: { rawBody: Buffer; headers: Headers }) {
  return handleShadowfaxWebhook(prisma, getFulfilmentProvider(), input);
}
export function reconcileShipmentNow(shipmentId: string) {
  return reconcileShipment(prisma, getFulfilmentProvider(), { shipmentId });
}
export function inspectRtoNow(input: {
  shipmentId: string;
  adminUserId: string;
  outcome: RtoOutcome;
  reason: string;
}) {
  return inspectRtoReturn(prisma, input);
}
export function syncCodRemittanceNow(shipmentId: string) {
  return syncCodRemittance(prisma, getFulfilmentProvider(), { shipmentId });
}
export function getShipmentLabelNow(shipmentId: string) {
  return getShipmentLabel(prisma, getFulfilmentProvider(), { shipmentId });
}

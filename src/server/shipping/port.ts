import "server-only";

import type { ShippingPort, ShippingQuote, ShippingQuoteRequest } from "./index";

/**
 * Provider-neutral shipping boundary (master §8 "Shadowfax"). Shadowfax is one
 * last-mile carrier — there is no courier-selection step, only AWB assignment —
 * but the interface stays provider-agnostic so a different carrier could be
 * swapped in. The rest of the app only ever sees the normalised local types
 * here; a provider's wire shape never escapes its adapter. All network calls
 * happen OUTSIDE database transactions.
 *
 * `ShippingProvider` extends the Phase 5 quote-only `ShippingPort` with the
 * fulfilment surface: create / track / cancel / label / COD remittance, plus a
 * webhook parser that returns a *hint* only (Shadowfax callback auth is weak or
 * absent, so state transitions are always re-verified against the tracking API).
 */

export class ShippingError extends Error {}

export class ShippingNotConfiguredError extends ShippingError {
  constructor() {
    super("Shadowfax is not configured in this environment.");
    this.name = "ShippingNotConfiguredError";
  }
}

export class ShippingApiError extends ShippingError {
  constructor(
    readonly httpStatus: number,
    readonly detail: string,
  ) {
    super(`Shadowfax API error (${httpStatus}): ${detail}`);
    this.name = "ShippingApiError";
  }
}

export interface ShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  stateName: string;
  stateCode: string;
  postcode: string;
  country: string;
}

export interface ShipmentParcelItem {
  descriptor: string;
  sku: string;
  quantity: number;
  unitValuePaise: number;
}

export interface CreateShipmentInput {
  /** Our `Shipment.merchantReference` — the idempotency key for creation. */
  merchantReference: string;
  pickup: ShippingAddress;
  drop: ShippingAddress;
  paymentMethod: "PREPAID_RAZORPAY" | "COD";
  /** Amount to collect on delivery, paise. 0 for prepaid. */
  codAmountPaise: number;
  items: ShipmentParcelItem[];
  weightGrams: number;
  dimensionsMm?: { length: number; width: number; height: number };
  invoiceValuePaise: number;
}

export interface CreatedShipment {
  providerShipmentId: string;
  awb: string | null;
  courier: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  statusRaw: string;
  raw: unknown;
}

export interface NormalizedTrackingEvent {
  /** Stable provider event id if the API exposes one; usually null for Shadowfax. */
  externalEventId: string | null;
  statusRaw: string;
  occurredAt: Date | null;
  note: string | null;
  raw: unknown;
}

export interface TrackingSnapshot {
  awb: string | null;
  statusRaw: string;
  events: NormalizedTrackingEvent[];
  raw: unknown;
}

export interface CodRemittanceRecord {
  merchantReference: string | null;
  awb: string | null;
  collectedPaise: number | null;
  remittedPaise: number | null;
  providerReference: string | null;
  collectedAt: Date | null;
  remittedAt: Date | null;
  raw: unknown;
}

export interface LabelFile {
  contentType: string;
  bytes: Buffer;
}

/**
 * What a Shadowfax callback tells us — a hint, not an authority. `fingerprint`
 * dedupes redelivered callbacks (no stable event id). The service re-reads the
 * tracking API before changing any state.
 */
export interface WebhookHint {
  merchantReference: string | null;
  awb: string | null;
  statusRaw: string;
  occurredAt: Date | null;
  fingerprint: string;
  raw: unknown;
}

export interface ShippingProvider extends ShippingPort {
  readonly name: string;
  readonly enabled: boolean;

  quote(req: ShippingQuoteRequest): Promise<ShippingQuote>;

  createShipment(input: CreateShipmentInput): Promise<CreatedShipment>;
  fetchTracking(ref: {
    awb?: string | null;
    merchantReference?: string | null;
  }): Promise<TrackingSnapshot>;
  cancelShipment(ref: {
    awb?: string | null;
    merchantReference: string;
  }): Promise<{ cancelled: boolean; raw: unknown }>;
  fetchLabel(ref: { awb: string }): Promise<LabelFile>;
  fetchCodRemittance(ref: {
    merchantReference?: string | null;
    awb?: string | null;
  }): Promise<CodRemittanceRecord | null>;

  /** Parse + coarse-verify a raw callback. Throws `WebhookVerificationError`
   *  only when a configured `SHADOWFAX_WEBHOOK_TOKEN` is present and mismatched. */
  parseWebhook(rawBody: Buffer, headers: Headers): WebhookHint;
}

import "server-only";

import { createHash } from "node:crypto";

import { WebhookVerificationError } from "@/server/webhooks/inbox";

import type {
  ShippingQuote,
  ShippingQuoteRequest,
} from "./index";
import {
  ShippingApiError,
  type CodRemittanceRecord,
  type CreateShipmentInput,
  type CreatedShipment,
  type LabelFile,
  type NormalizedTrackingEvent,
  type ShippingProvider,
  type TrackingSnapshot,
  type WebhookHint,
} from "./port";

// Confirmed 2026-09-11 against Shadowfax's live "Unified API for Forward
// Integrations" docs (sfxunifiedapi.docs.apiary.io) — this is the real base URL
// pair, not a guess. Two different environments, not an override switch on one
// host.
const STAGING_BASE = "https://dale.staging.shadowfax.in/api";
const PRODUCTION_BASE = "https://dale.shadowfax.in/api";

export interface ShadowfaxConfig {
  apiToken: string;
  /** Static token Shadowfax echoes on its callback, if the account configures one. */
  webhookToken?: string | null;
  /** Selects the staging or production base URL. Defaults to "staging" — never
   *  guess your way into hitting production. Ignored when `apiBase` is set. */
  environment?: "staging" | "production";
  apiBase?: string;
  fetchImpl?: typeof fetch;
  /** Flat rate charged to the customer; Shadowfax's serviceability API returns
   *  no price, only whether/how a pincode is served. */
  flatShippingPaise?: number;
  codFeePaise?: number;
}

/**
 * Shadowfax adapter (master §8, v1.1) — the "Marketplace / seller pickup"
 * integration: a Shadowfax rider collects each order from our registered
 * address and delivers it, one AWB per shipment, no courier selection. All
 * network access is confined here.
 *
 * Endpoint paths, auth and payload shapes below are taken directly from
 * Shadowfax's live "Unified API for Forward Integrations" documentation
 * (sfxunifiedapi.docs.apiary.io, checked 2026-09-11) — not the placeholder
 * shape this file originally shipped with. Two things the docs never describe
 * a self-serve API for: fetching a printable shipping label, and reading COD
 * remittance status — `fetchLabel`/`fetchCodRemittance` say so explicitly
 * rather than guessing at an endpoint. The normalisation layer and every
 * caller are written against the neutral port, so only this file changes if
 * Shadowfax's shape moves again.
 */
export class ShadowfaxProvider implements ShippingProvider {
  readonly name = "shadowfax";
  readonly enabled = true;

  private readonly apiToken: string;
  private readonly webhookToken: string | null;
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly flatShippingPaise: number;
  private readonly codFeePaise: number;

  constructor(config: ShadowfaxConfig) {
    this.apiToken = config.apiToken;
    this.webhookToken = config.webhookToken ?? null;
    this.apiBase =
      config.apiBase ??
      (config.environment === "production" ? PRODUCTION_BASE : STAGING_BASE);
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.flatShippingPaise = config.flatShippingPaise ?? 8_000;
    this.codFeePaise = config.codFeePaise ?? 3_000;
  }

  private async call<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.apiBase}${path}`, {
        method,
        headers: {
          // Shadowfax uses plain Token auth — the literal word "Token" plus the
          // key, no client-id header (docs: "Authentication").
          Authorization: `Token ${this.apiToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ShippingApiError(0, (e as Error).message);
    }
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : {};
    if (!res.ok) {
      const detail =
        (json as { message?: string; responseMsg?: string; detail?: string })
          ?.message ??
        (json as { responseMsg?: string })?.responseMsg ??
        (json as { detail?: string })?.detail ??
        text ??
        res.statusText;
      throw new ShippingApiError(res.status, detail);
    }
    return json as T;
  }

  // ── checkout-time ──────────────────────────────────────────────────────────
  async quote(req: ShippingQuoteRequest): Promise<ShippingQuote> {
    // Shadowfax's serviceability endpoint answers "is this pincode served, and
    // how" (service tiers like "Regular"/"Surface") — it carries no COD/prepaid
    // split and no price, so those stay config-driven (flatShippingPaise /
    // codFeePaise) rather than invented from a field the API doesn't return.
    let serviceable = true;
    try {
      const rows = await this.call<{ code: number; services: string[] }[]>(
        "GET",
        `/v1/clients/serviceability/?service=customer_delivery&pincodes=${encodeURIComponent(req.destinationPostcode)}`,
      );
      serviceable = rows.some((r) => String(r.code) === req.destinationPostcode);
    } catch (e) {
      // Serviceability lookups that error out should not silently block checkout;
      // fall back to "serviceable, no COD" and let reconciliation/ops catch it.
      if (e instanceof ShippingApiError && e.httpStatus >= 500) {
        serviceable = true;
      } else {
        throw e;
      }
    }

    if (!serviceable) {
      return {
        serviceable: false,
        shippingPaise: 0,
        codAllowed: false,
        codFeePaise: 0,
        reason: "Delivery is not available to this PIN code.",
      };
    }
    // Shadowfax's serviceability response carries no per-pincode COD/prepaid
    // split — COD availability is an account-level contract term, not a
    // per-request signal, so it's assumed on wherever the pincode is served.
    const codAllowed = true;
    return {
      serviceable: true,
      shippingPaise: this.flatShippingPaise,
      codAllowed,
      codFeePaise: req.paymentMethod === "COD" ? this.codFeePaise : 0,
    };
  }

  // ── fulfilment ────────────────────────────────────────────────────────────
  async createShipment(input: CreateShipmentInput): Promise<CreatedShipment> {
    const totalRupees = Math.round(input.invoiceValuePaise) / 100;
    const res = await this.call<{
      message?: string;
      errors?: unknown;
      data?: {
        id?: number;
        awb_number?: string;
        status?: string;
        status_display?: string;
      };
    }>("POST", "/v3/clients/orders/", {
      order_type: "marketplace",
      order_details: {
        client_order_id: input.merchantReference,
        actual_weight: input.weightGrams,
        volumetric_weight: input.dimensionsMm
          ? Math.round(
              (input.dimensionsMm.length *
                input.dimensionsMm.width *
                input.dimensionsMm.height) /
                5000 /
                1000, // mm³ → cm³ (÷1000) → volumetric grams (÷5000 divisor)
            )
          : input.weightGrams,
        product_value: totalRupees,
        payment_mode: input.paymentMethod === "COD" ? "COD" : "Prepaid",
        cod_amount: String(Math.round(input.codAmountPaise) / 100),
        total_amount: totalRupees,
        order_service: "regular",
      },
      customer_details: addressPayload(input.drop),
      pickup_details: addressPayload(input.pickup),
      // Return-to-seller destination for an RTO — same as pickup, since we have
      // no separate warehouse/return address in the port today.
      rts_details: addressPayload(input.pickup),
      product_details: input.items.map((i) => ({
        sku_id: i.sku,
        sku_name: i.descriptor,
        price: Math.round(i.unitValuePaise) / 100,
        category: "General",
        additional_details: { quantity: i.quantity },
        // hsn_code / gstin_number / taxes intentionally omitted: not wired to a
        // real GST config yet (release-candidate blocker #5, owner-confirmed
        // business/tax setup) — sending fabricated figures would be worse than
        // omitting them.
      })),
    });
    if (res.errors) {
      throw new ShippingApiError(502, JSON.stringify(res.errors));
    }
    const awb = res.data?.awb_number ?? null;
    const providerShipmentId = res.data?.id != null ? String(res.data.id) : awb;
    if (!providerShipmentId) {
      throw new ShippingApiError(502, "create returned no order id / AWB");
    }
    return {
      providerShipmentId,
      awb,
      courier: "Shadowfax",
      trackingUrl: null, // only present on the tracking-detail response, not create
      labelUrl: null, // Shadowfax's docs expose no self-serve label-download API
      statusRaw: res.data?.status ?? "new",
      raw: res,
    };
  }

  async fetchTracking(ref: {
    awb?: string | null;
    merchantReference?: string | null;
  }): Promise<TrackingSnapshot> {
    if (!ref.awb) {
      // The v4 tracking endpoint is keyed by AWB in the URL path — Shadowfax's
      // docs show no client-order-id lookup for it.
      throw new ShippingApiError(400, "fetchTracking requires an AWB");
    }
    const res = await this.call<{
      order_details?: { status?: string; customer_track_url?: string };
      tracking_details?: {
        status_id?: string;
        status?: string;
        remarks?: string;
        created?: string;
        location?: string;
      }[];
    }>("GET", `/v4/clients/orders/${encodeURIComponent(ref.awb)}/track/`);
    const events: NormalizedTrackingEvent[] = (res.tracking_details ?? []).map(
      (s) => ({
        externalEventId: null,
        statusRaw: s.status_id ?? s.status ?? "UNKNOWN",
        occurredAt: parseTs(s.created),
        note: s.remarks ?? null,
        raw: s,
      }),
    );
    return {
      awb: ref.awb,
      statusRaw: res.order_details?.status ?? "UNKNOWN",
      events,
      raw: res,
    };
  }

  async cancelShipment(ref: {
    awb?: string | null;
    merchantReference: string;
  }): Promise<{ cancelled: boolean; raw: unknown }> {
    const requestId = ref.awb ?? ref.merchantReference;
    const res = await this.call<{ responseMsg?: string; responseCode?: number }>(
      "POST",
      "/v3/clients/orders/cancel/",
      { request_id: requestId, cancel_remarks: "Cancelled by merchant" },
    );
    // 200 = cancelled now; 304 = accepted, executes once the shipment reaches
    // the next facility — either way the cancellation was accepted.
    const cancelled = res.responseCode === 200 || res.responseCode === 304;
    return { cancelled, raw: res };
  }

  async fetchLabel(ref: { awb: string }): Promise<LabelFile> {
    // Shadowfax's documented API has no self-serve "download this AWB's label"
    // endpoint — labels are generated/printed from the Shadowfax360 dashboard.
    // Throwing a clear, typed error here beats silently calling a made-up path.
    throw new ShippingApiError(
      501,
      `Shadowfax has no documented label-download API; print the label for AWB ${ref.awb} from the Shadowfax360 dashboard.`,
    );
  }

  async fetchCodRemittance(ref: {
    merchantReference?: string | null;
    awb?: string | null;
  }): Promise<CodRemittanceRecord | null> {
    void ref;
    // Same gap as fetchLabel: no documented self-serve remittance-lookup
    // endpoint (COD remittance lives under the Shadowfax360 dashboard's Finance
    // tab). Returning null is the port's existing "nothing to reconcile yet"
    // signal, so this stays a safe no-op until that endpoint is confirmed.
    return null;
  }

  // ── webhook (weak auth by design) ─────────────────────────────────────────
  parseWebhook(rawBody: Buffer, headers: Headers): WebhookHint {
    // Coarse gate: if the account configured a static callback token, require it.
    if (this.webhookToken) {
      const presented =
        headers.get("x-shadowfax-token") ??
        headers.get("authorization")?.replace(/^Token\s+/i, "") ??
        "";
      if (!safeEqual(presented, this.webhookToken)) {
        throw new WebhookVerificationError("shadowfax callback token mismatch");
      }
    }
    let body: {
      order_id?: string;
      awb_number?: string;
      event?: string;
      status?: string;
      event_timestamp?: string;
      comments?: string;
    };
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new WebhookVerificationError("shadowfax callback body is not JSON");
    }
    const statusRaw = (body.event ?? body.status ?? "UNKNOWN").toString();
    const occurredAt = parseTs(body.event_timestamp);
    const fingerprint = createHash("sha256")
      .update(rawBody)
      .digest("hex")
      .slice(0, 40);
    return {
      merchantReference: body.order_id ?? null,
      awb: body.awb_number ?? null,
      statusRaw,
      occurredAt,
      fingerprint,
      raw: body,
    };
  }
}

function addressPayload(a: {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  stateName: string;
  postcode: string;
}) {
  return {
    name: a.name,
    contact: a.phone,
    address_line_1: a.line1,
    address_line_2: [a.line2, a.landmark].filter(Boolean).join(", ") || undefined,
    city: a.city,
    state: a.stateName,
    pincode: Number(a.postcode),
  };
}

function parseTs(v: string | undefined | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

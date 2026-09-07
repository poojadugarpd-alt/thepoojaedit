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

const API_BASE = "https://api.shadowfax.in";

export interface ShadowfaxConfig {
  apiToken: string;
  clientId: string;
  /** Static token Shadowfax echoes on its callback, if the account configures one. */
  webhookToken?: string | null;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  /** Merchant pickup pincode, for serviceability + rate. */
  pickupPostcode?: string;
  /** Flat rate fallback when the account has no rate API enabled. */
  flatShippingPaise?: number;
  codFeePaise?: number;
}

/**
 * Shadowfax adapter (master §8, v1.1). Single last-mile carrier — `createShipment`
 * returns one AWB, no courier selection. All network access is confined here.
 *
 * Endpoint paths and payload field names below follow Shadowfax's documented
 * merchant API shape but MUST be confirmed against the live account before
 * go-live (docs/integration-setup.md); the normalisation layer and every caller
 * are written against the neutral port, so only this file changes if they differ.
 */
export class ShadowfaxProvider implements ShippingProvider {
  readonly name = "shadowfax";
  readonly enabled = true;

  private readonly apiToken: string;
  private readonly clientId: string;
  private readonly webhookToken: string | null;
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pickupPostcode: string;
  private readonly flatShippingPaise: number;
  private readonly codFeePaise: number;

  constructor(config: ShadowfaxConfig) {
    this.apiToken = config.apiToken;
    this.clientId = config.clientId;
    this.webhookToken = config.webhookToken ?? null;
    this.apiBase = config.apiBase ?? API_BASE;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.pickupPostcode = config.pickupPostcode ?? "";
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
          Authorization: `Token ${this.apiToken}`,
          "X-Client-Id": this.clientId,
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
        (json as { message?: string; detail?: string })?.message ??
        (json as { detail?: string })?.detail ??
        text ??
        res.statusText;
      throw new ShippingApiError(res.status, detail);
    }
    return json as T;
  }

  // ── checkout-time ──────────────────────────────────────────────────────────
  async quote(req: ShippingQuoteRequest): Promise<ShippingQuote> {
    let serviceable = true;
    let codAllowed = req.paymentMethod !== "COD";
    let etaDays: number | null = null;
    try {
      const s = await this.call<{
        serviceable?: boolean;
        cod?: boolean;
        prepaid?: boolean;
        tat_days?: number;
      }>("POST", "/api/v2/serviceability/", {
        pickup_pincode: this.pickupPostcode,
        drop_pincode: req.destinationPostcode,
        payment_type: req.paymentMethod === "COD" ? "COD" : "PREPAID",
      });
      serviceable = s.serviceable ?? true;
      codAllowed = req.paymentMethod === "COD" ? Boolean(s.cod) : true;
      etaDays = s.tat_days ?? null;
    } catch (e) {
      // Serviceability lookups that error out should not silently block checkout;
      // fall back to "serviceable, no COD" and let reconciliation/ops catch it.
      if (e instanceof ShippingApiError && e.httpStatus >= 500) {
        serviceable = true;
        codAllowed = false;
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
    return {
      serviceable: true,
      shippingPaise: this.flatShippingPaise,
      codAllowed,
      codFeePaise: req.paymentMethod === "COD" && codAllowed ? this.codFeePaise : 0,
      ...(etaDays != null ? { etaDays } : {}),
    } as ShippingQuote;
  }

  // ── fulfilment ────────────────────────────────────────────────────────────
  async createShipment(input: CreateShipmentInput): Promise<CreatedShipment> {
    const res = await this.call<{
      sfx_order_id?: string;
      order_id?: string;
      awb_number?: string;
      awb?: string;
      status?: string;
      label_url?: string;
      tracking_url?: string;
    }>("POST", "/api/v3/orders/", {
      client_order_id: input.merchantReference,
      payment_type: input.paymentMethod === "COD" ? "COD" : "PREPAID",
      cod_amount: Math.round(input.codAmountPaise) / 100,
      order_value: Math.round(input.invoiceValuePaise) / 100,
      weight_grams: input.weightGrams,
      ...(input.dimensionsMm
        ? {
            length_cm: input.dimensionsMm.length / 10,
            breadth_cm: input.dimensionsMm.width / 10,
            height_cm: input.dimensionsMm.height / 10,
          }
        : {}),
      pickup_details: addressPayload(input.pickup),
      drop_details: addressPayload(input.drop),
      items: input.items.map((i) => ({
        name: i.descriptor,
        sku: i.sku,
        quantity: i.quantity,
        price: Math.round(i.unitValuePaise) / 100,
      })),
    });
    const providerShipmentId = res.sfx_order_id ?? res.order_id ?? "";
    if (!providerShipmentId) {
      throw new ShippingApiError(502, "create returned no order id");
    }
    return {
      providerShipmentId,
      awb: res.awb_number ?? res.awb ?? null,
      courier: "Shadowfax",
      trackingUrl: res.tracking_url ?? null,
      labelUrl: res.label_url ?? null,
      statusRaw: res.status ?? "PENDING",
      raw: res,
    };
  }

  async fetchTracking(ref: {
    awb?: string | null;
    merchantReference?: string | null;
  }): Promise<TrackingSnapshot> {
    const qs = ref.awb
      ? `awb=${encodeURIComponent(ref.awb)}`
      : `client_order_id=${encodeURIComponent(ref.merchantReference ?? "")}`;
    const res = await this.call<{
      awb_number?: string;
      current_status?: string;
      status?: string;
      scans?: {
        status?: string;
        status_code?: string;
        remarks?: string;
        timestamp?: string;
        updated_at?: string;
      }[];
    }>("GET", `/api/v2/orders/track/?${qs}`);
    const events: NormalizedTrackingEvent[] = (res.scans ?? []).map((s) => ({
      externalEventId: null,
      statusRaw: s.status_code ?? s.status ?? "UNKNOWN",
      occurredAt: parseTs(s.timestamp ?? s.updated_at),
      note: s.remarks ?? null,
      raw: s,
    }));
    return {
      awb: res.awb_number ?? ref.awb ?? null,
      statusRaw: res.current_status ?? res.status ?? "UNKNOWN",
      events,
      raw: res,
    };
  }

  async cancelShipment(ref: {
    awb?: string | null;
    merchantReference: string;
  }): Promise<{ cancelled: boolean; raw: unknown }> {
    const res = await this.call<{ success?: boolean; status?: string }>(
      "POST",
      "/api/v3/orders/cancel/",
      ref.awb
        ? { awb_number: ref.awb }
        : { client_order_id: ref.merchantReference },
    );
    return { cancelled: res.success ?? res.status === "CANCELLED", raw: res };
  }

  async fetchLabel(ref: { awb: string }): Promise<LabelFile> {
    let res: Response;
    try {
      res = await this.fetchImpl(
        `${this.apiBase}/api/v2/orders/label/?awb=${encodeURIComponent(ref.awb)}`,
        {
          headers: {
            Authorization: `Token ${this.apiToken}`,
            "X-Client-Id": this.clientId,
          },
        },
      );
    } catch (e) {
      throw new ShippingApiError(0, (e as Error).message);
    }
    if (!res.ok) throw new ShippingApiError(res.status, await res.text());
    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      contentType: res.headers.get("content-type") ?? "application/pdf",
      bytes,
    };
  }

  async fetchCodRemittance(ref: {
    merchantReference?: string | null;
    awb?: string | null;
  }): Promise<CodRemittanceRecord | null> {
    const qs = ref.awb
      ? `awb=${encodeURIComponent(ref.awb)}`
      : `client_order_id=${encodeURIComponent(ref.merchantReference ?? "")}`;
    const res = await this.call<{
      awb_number?: string;
      client_order_id?: string;
      collected_amount?: number;
      remitted_amount?: number;
      utr?: string;
      collected_at?: string;
      remitted_at?: string;
    } | null>("GET", `/api/cod/remittance/?${qs}`);
    if (!res) return null;
    return {
      merchantReference: res.client_order_id ?? ref.merchantReference ?? null,
      awb: res.awb_number ?? ref.awb ?? null,
      collectedPaise:
        res.collected_amount != null ? Math.round(res.collected_amount * 100) : null,
      remittedPaise:
        res.remitted_amount != null ? Math.round(res.remitted_amount * 100) : null,
      providerReference: res.utr ?? null,
      collectedAt: parseTs(res.collected_at),
      remittedAt: parseTs(res.remitted_at),
      raw: res,
    };
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
      client_order_id?: string;
      awb_number?: string;
      awb?: string;
      status?: string;
      status_code?: string;
      timestamp?: string;
      updated_at?: string;
    };
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new WebhookVerificationError("shadowfax callback body is not JSON");
    }
    const statusRaw = (body.status_code ?? body.status ?? "UNKNOWN").toString();
    const occurredAt = parseTs(body.timestamp ?? body.updated_at);
    const fingerprint = createHash("sha256")
      .update(rawBody)
      .digest("hex")
      .slice(0, 40);
    return {
      merchantReference: body.client_order_id ?? null,
      awb: body.awb_number ?? body.awb ?? null,
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
    phone: a.phone,
    address: [a.line1, a.line2, a.landmark].filter(Boolean).join(", "),
    city: a.city,
    state: a.stateName,
    pincode: a.postcode,
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

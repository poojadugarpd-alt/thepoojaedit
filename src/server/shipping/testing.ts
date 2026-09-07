import "server-only";

import { createHash } from "node:crypto";

import { WebhookVerificationError } from "@/server/webhooks/inbox";

import type { ShippingQuote, ShippingQuoteRequest } from "./index";
import {
  ShippingApiError,
  type CodRemittanceRecord,
  type CreateShipmentInput,
  type CreatedShipment,
  type LabelFile,
  type ShippingProvider,
  type TrackingSnapshot,
  type WebhookHint,
} from "./port";

/**
 * Deterministic in-memory Shadowfax double for tests and local demos. Models the
 * behaviours the Phase 8 checks exercise: idempotent creation, provider
 * timeouts, tracking scans (including out-of-order), NDR repeats, RTO, cancel,
 * label bytes, and COD collected-vs-remitted.
 */
const NON_SERVICEABLE = new Set(["000000", "999999", "111111"]);
const COD_BLOCKED = new Set(["560100"]);

interface FakeShipment {
  merchantReference: string;
  providerShipmentId: string;
  awb: string;
  statusRaw: string;
  codAmountPaise: number;
  scans: { statusRaw: string; occurredAt: Date | null; note: string | null }[];
  cancelled: boolean;
  collectedPaise: number | null;
  remittedPaise: number | null;
  providerReference: string | null;
  collectedAt: Date | null;
  remittedAt: Date | null;
}

export const FAKE_WEBHOOK_TOKEN = "fake_sfx_callback_token_000";

export class FakeShadowfax implements ShippingProvider {
  readonly name = "shadowfax";
  readonly enabled = true;

  private seq = 0;
  readonly shipments = new Map<string, FakeShipment>();
  /** Fail the next createShipment once, AFTER recording the shipment (timeout-after-creation). */
  failNextCreateAfterRecord = false;
  /** Fail the next createShipment once, BEFORE recording anything (timeout-before-creation). */
  failNextCreateBeforeRecord = false;
  webhookToken: string | null = null;
  flatShippingPaise = 8_000;
  codFeePaise = 3_000;

  private id(prefix: string): string {
    this.seq += 1;
    return `${prefix}${String(this.seq).padStart(10, "0")}`;
  }

  async quote(req: ShippingQuoteRequest): Promise<ShippingQuote> {
    if (NON_SERVICEABLE.has(req.destinationPostcode)) {
      return {
        serviceable: false,
        shippingPaise: 0,
        codAllowed: false,
        codFeePaise: 0,
        reason: "Delivery is not available to this PIN code.",
      };
    }
    const codAllowed =
      req.paymentMethod === "COD" ? !COD_BLOCKED.has(req.destinationPostcode) : true;
    return {
      serviceable: true,
      shippingPaise: this.flatShippingPaise,
      codAllowed,
      codFeePaise: req.paymentMethod === "COD" && codAllowed ? this.codFeePaise : 0,
      etaDays: 3,
    } as ShippingQuote;
  }

  async createShipment(input: CreateShipmentInput): Promise<CreatedShipment> {
    if (this.failNextCreateBeforeRecord) {
      this.failNextCreateBeforeRecord = false;
      throw new ShippingApiError(504, "simulated timeout before creation");
    }
    let s = this.shipments.get(input.merchantReference);
    if (!s) {
      s = {
        merchantReference: input.merchantReference,
        providerShipmentId: this.id("SFX"),
        awb: this.id("AWB"),
        statusRaw: "PENDING",
        codAmountPaise: input.codAmountPaise,
        scans: [],
        cancelled: false,
        collectedPaise: null,
        remittedPaise: null,
        providerReference: null,
        collectedAt: null,
        remittedAt: null,
      };
      this.shipments.set(input.merchantReference, s);
    }
    if (this.failNextCreateAfterRecord) {
      this.failNextCreateAfterRecord = false;
      throw new ShippingApiError(504, "simulated timeout after creation");
    }
    return {
      providerShipmentId: s.providerShipmentId,
      awb: s.awb,
      courier: "Shadowfax",
      trackingUrl: `https://track.shadowfax.example/${s.awb}`,
      labelUrl: `https://label.shadowfax.example/${s.awb}.pdf`,
      statusRaw: s.statusRaw,
      raw: s,
    };
  }

  async fetchTracking(ref: {
    awb?: string | null;
    merchantReference?: string | null;
  }): Promise<TrackingSnapshot> {
    const s = this.find(ref);
    if (!s) throw new ShippingApiError(404, "unknown shipment");
    return {
      awb: s.awb,
      statusRaw: s.statusRaw,
      events: s.scans.map((sc) => ({
        externalEventId: null,
        statusRaw: sc.statusRaw,
        occurredAt: sc.occurredAt,
        note: sc.note,
        raw: sc,
      })),
      raw: s,
    };
  }

  async cancelShipment(ref: {
    awb?: string | null;
    merchantReference: string;
  }): Promise<{ cancelled: boolean; raw: unknown }> {
    const s = this.find(ref);
    if (!s) throw new ShippingApiError(404, "unknown shipment");
    s.cancelled = true;
    s.statusRaw = "CANCELLED";
    s.scans.push({ statusRaw: "CANCELLED", occurredAt: new Date(), note: null });
    return { cancelled: true, raw: s };
  }

  async fetchLabel(ref: { awb: string }): Promise<LabelFile> {
    const s = this.find({ awb: ref.awb });
    if (!s) throw new ShippingApiError(404, "unknown shipment");
    return {
      contentType: "application/pdf",
      bytes: Buffer.from(`%PDF-1.4 fake label ${s.awb}`),
    };
  }

  async fetchCodRemittance(ref: {
    merchantReference?: string | null;
    awb?: string | null;
  }): Promise<CodRemittanceRecord | null> {
    const s = this.find(ref);
    if (!s) return null;
    return {
      merchantReference: s.merchantReference,
      awb: s.awb,
      collectedPaise: s.collectedPaise,
      remittedPaise: s.remittedPaise,
      providerReference: s.providerReference,
      collectedAt: s.collectedAt,
      remittedAt: s.remittedAt,
      raw: s,
    };
  }

  parseWebhook(rawBody: Buffer, headers: Headers): WebhookHint {
    if (this.webhookToken) {
      const presented =
        headers.get("x-shadowfax-token") ??
        headers.get("authorization")?.replace(/^Token\s+/i, "") ??
        "";
      if (presented !== this.webhookToken) {
        throw new WebhookVerificationError("shadowfax callback token mismatch");
      }
    }
    const body = JSON.parse(rawBody.toString("utf8")) as {
      client_order_id?: string;
      awb_number?: string;
      status_code?: string;
      status?: string;
      timestamp?: string;
    };
    return {
      merchantReference: body.client_order_id ?? null,
      awb: body.awb_number ?? null,
      statusRaw: body.status_code ?? body.status ?? "UNKNOWN",
      occurredAt: body.timestamp ? new Date(body.timestamp) : null,
      fingerprint: createHash("sha256").update(rawBody).digest("hex").slice(0, 40),
      raw: body,
    };
  }

  // ── test-only simulation helpers ─────────────────────────────────────────
  /** Append a courier scan (the source of truth the reconcile step reads). */
  simulateScan(
    ref: { merchantReference?: string; awb?: string },
    statusRaw: string,
    occurredAt: Date,
    note?: string,
  ): void {
    const s = this.find(ref);
    if (!s) throw new Error("unknown fake shipment");
    s.scans.push({ statusRaw, occurredAt, note: note ?? null });
    // "current" status follows the most recent scan by occurredAt
    const newest = [...s.scans].sort(
      (a, b) => (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0),
    )[0];
    s.statusRaw = newest.statusRaw;
  }

  simulateCodCollected(
    ref: { merchantReference?: string; awb?: string },
    collectedPaise: number,
    at = new Date(),
  ): void {
    const s = this.find(ref);
    if (!s) throw new Error("unknown fake shipment");
    s.collectedPaise = collectedPaise;
    s.collectedAt = at;
  }

  simulateCodRemitted(
    ref: { merchantReference?: string; awb?: string },
    remittedPaise: number,
    providerReference: string,
    at = new Date(),
  ): void {
    const s = this.find(ref);
    if (!s) throw new Error("unknown fake shipment");
    s.remittedPaise = remittedPaise;
    s.providerReference = providerReference;
    s.remittedAt = at;
  }

  buildWebhook(
    ref: { merchantReference?: string; awb?: string },
    statusRaw: string,
    occurredAt: Date,
    opts?: { token?: string },
  ): { rawBody: Buffer; headers: Headers } {
    const s = ref.merchantReference
      ? this.shipments.get(ref.merchantReference)
      : this.find(ref);
    const rawBody = Buffer.from(
      JSON.stringify({
        client_order_id: ref.merchantReference ?? s?.merchantReference ?? null,
        awb_number: ref.awb ?? s?.awb ?? null,
        status_code: statusRaw,
        timestamp: occurredAt.toISOString(),
      }),
      "utf8",
    );
    const headers = new Headers({ "content-type": "application/json" });
    if (opts?.token) headers.set("x-shadowfax-token", opts.token);
    return { rawBody, headers };
  }

  private find(ref: {
    merchantReference?: string | null;
    awb?: string | null;
  }): FakeShipment | undefined {
    if (ref.merchantReference && this.shipments.has(ref.merchantReference)) {
      return this.shipments.get(ref.merchantReference);
    }
    for (const s of this.shipments.values()) {
      if (ref.awb && s.awb === ref.awb) return s;
      if (ref.merchantReference && s.merchantReference === ref.merchantReference) {
        return s;
      }
    }
    return undefined;
  }
}

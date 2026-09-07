import "server-only";

import { createHmac } from "node:crypto";

import { webhookSignature } from "./razorpay-crypto";
import { RazorpayProvider } from "./razorpay";
import {
  ProviderApiError,
  type CreateOrderInput,
  type CreateRefundInput,
  type CreatedProviderOrder,
  type NormalizedPayment,
  type NormalizedRefund,
} from "./port";

/**
 * Deterministic in-memory Razorpay double for tests and local demos.
 *
 * It EXTENDS `RazorpayProvider` and overrides only the network methods, so the
 * real signature-verification and payload-normalisation code paths run
 * unchanged — `verifyCheckoutSignature`, `verifyWebhook` and the normalisers
 * are inherited verbatim. `signCheckout` / `buildWebhook` produce genuine
 * HMACs with the fixed test secrets, so a test that feeds them back in is
 * exercising the same crypto the production adapter uses.
 */
export const FAKE_KEY_ID = "rzp_test_fake0000000000";
export const FAKE_KEY_SECRET = "fake_key_secret_0000000000";
export const FAKE_WEBHOOK_SECRET = "fake_webhook_secret_0000000000";

interface FakeOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  operationKey: string;
}
interface FakePayment {
  id: string;
  order_id: string;
  status: "created" | "authorized" | "captured" | "failed" | "refunded";
  amount: number;
  amount_refunded: number;
  currency: string;
  method: string | null;
  captured: boolean;
}
interface FakeRefund {
  id: string;
  payment_id: string;
  status: "pending" | "processed" | "failed";
  amount: number;
}

export class FakeRazorpay extends RazorpayProvider {
  private seq = 0;
  readonly orders = new Map<string, FakeOrder>();
  readonly payments = new Map<string, FakePayment>();
  readonly refunds = new Map<string, FakeRefund>();
  /** Fail the next createOrder call once (simulates a provider outage). */
  failNextCreateOrder = false;

  constructor(overrides?: { keySecret?: string; webhookSecret?: string }) {
    super({
      keyId: FAKE_KEY_ID,
      keySecret: overrides?.keySecret ?? FAKE_KEY_SECRET,
      webhookSecret: overrides?.webhookSecret ?? FAKE_WEBHOOK_SECRET,
    });
  }

  private id(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${String(this.seq).padStart(14, "0")}`;
  }

  // ── overridden network surface ──────────────────────────────────────────
  override async createOrder(input: CreateOrderInput): Promise<CreatedProviderOrder> {
    if (this.failNextCreateOrder) {
      this.failNextCreateOrder = false;
      throw new ProviderApiError("razorpay", 502, "simulated provider outage");
    }
    const order: FakeOrder = {
      id: this.id("order"),
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      operationKey: input.operationKey,
    };
    this.orders.set(order.id, order);
    return {
      providerOrderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      raw: order,
    };
  }

  override async fetchPayment(providerPaymentId: string): Promise<NormalizedPayment> {
    const p = this.payments.get(providerPaymentId);
    if (!p) throw new ProviderApiError("razorpay", 404, "payment not found");
    return this.normalize(p);
  }

  override async fetchOrderPayments(
    providerOrderId: string,
  ): Promise<NormalizedPayment[]> {
    return [...this.payments.values()]
      .filter((p) => p.order_id === providerOrderId)
      .map((p) => this.normalize(p));
  }

  override async createRefund(input: CreateRefundInput): Promise<NormalizedRefund> {
    const p = this.payments.get(input.providerPaymentId);
    if (!p) throw new ProviderApiError("razorpay", 404, "payment not found");
    if (p.amount_refunded + input.amountPaise > p.amount) {
      throw new ProviderApiError("razorpay", 400, "refund exceeds captured amount");
    }
    p.amount_refunded += input.amountPaise;
    if (p.amount_refunded >= p.amount) p.status = "refunded";
    const refund: FakeRefund = {
      id: this.id("rfnd"),
      payment_id: p.id,
      status: "processed",
      amount: input.amountPaise,
    };
    this.refunds.set(refund.id, refund);
    return {
      providerRefundId: refund.id,
      providerPaymentId: p.id,
      status: refund.status,
      amountPaise: refund.amount,
      raw: refund,
    };
  }

  override async fetchRefund(providerRefundId: string): Promise<NormalizedRefund> {
    const r = this.refunds.get(providerRefundId);
    if (!r) throw new ProviderApiError("razorpay", 404, "refund not found");
    return {
      providerRefundId: r.id,
      providerPaymentId: r.payment_id,
      status: r.status,
      amountPaise: r.amount,
      raw: r,
    };
  }

  private normalize(p: FakePayment): NormalizedPayment {
    return {
      providerPaymentId: p.id,
      providerOrderId: p.order_id,
      status: p.status,
      amountPaise: p.amount,
      capturedAmountPaise: p.status === "captured" ? p.amount : 0,
      amountRefundedPaise: p.amount_refunded,
      currency: p.currency,
      method: p.method,
      raw: p,
    };
  }

  // ── test-only simulation helpers ───────────────────────────────────────
  /** Customer paid; money is authorised but not yet captured. */
  simulateAuthorized(
    providerOrderId: string,
    opts?: { amountPaise?: number; currency?: string; method?: string },
  ): NormalizedPayment {
    const order = this.orders.get(providerOrderId);
    if (!order) throw new Error(`unknown fake order ${providerOrderId}`);
    const p: FakePayment = {
      id: this.id("pay"),
      order_id: providerOrderId,
      status: "authorized",
      amount: opts?.amountPaise ?? order.amount,
      amount_refunded: 0,
      currency: opts?.currency ?? order.currency,
      method: opts?.method ?? "upi",
      captured: false,
    };
    this.payments.set(p.id, p);
    return this.normalize(p);
  }

  /** Authorise + capture in one step (Razorpay test-mode auto-capture). */
  simulateCaptured(
    providerOrderId: string,
    opts?: { amountPaise?: number; currency?: string; method?: string },
  ): NormalizedPayment {
    const p = this.simulateAuthorized(providerOrderId, opts);
    const stored = this.payments.get(p.providerPaymentId)!;
    stored.status = "captured";
    stored.captured = true;
    return this.normalize(stored);
  }

  simulateFailed(providerOrderId: string): NormalizedPayment {
    const p = this.simulateAuthorized(providerOrderId);
    const stored = this.payments.get(p.providerPaymentId)!;
    stored.status = "failed";
    return this.normalize(stored);
  }

  /** Genuine checkout-handoff signature the browser would post back. */
  signCheckout(providerOrderId: string, providerPaymentId: string): string {
    return createHmac("sha256", this.keySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest("hex");
  }

  /** A signed webhook delivery: raw bytes + headers, as the route receives it. */
  buildWebhook(
    eventType: string,
    entities: { payment?: NormalizedPayment; refund?: NormalizedRefund },
    opts?: { eventId?: string },
  ): { rawBody: Buffer; headers: Headers } {
    const body: Record<string, unknown> = { event: eventType, payload: {} };
    const payload = body.payload as Record<string, unknown>;
    if (entities.payment) {
      payload.payment = { entity: (entities.payment.raw as object) ?? entities.payment };
    }
    if (entities.refund) {
      payload.refund = { entity: (entities.refund.raw as object) ?? entities.refund };
    }
    const rawBody = Buffer.from(JSON.stringify(body), "utf8");
    const headers = new Headers({
      "content-type": "application/json",
      "x-razorpay-signature": webhookSignature(rawBody, this.webhookSecret),
      "x-razorpay-event-id":
        opts?.eventId ?? `evt_${this.id("wh")}`,
    });
    return { rawBody, headers };
  }
}

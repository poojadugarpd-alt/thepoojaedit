import "server-only";

import { createHash } from "node:crypto";

import { WebhookVerificationError } from "@/server/webhooks/inbox";

import {
  normalizeRazorpayPayment,
  normalizeRazorpayRefund,
  parseRazorpayWebhookBody,
  verifyCheckoutSignature as pureVerifyCheckout,
  verifyWebhookSignature as pureVerifyWebhook,
} from "./razorpay-crypto";
import {
  ProviderApiError,
  type CreateOrderInput,
  type CreateRefundInput,
  type CreatedProviderOrder,
  type NormalizedPayment,
  type NormalizedRefund,
  type PaymentProvider,
  type VerifiedProviderWebhook,
} from "./port";

const API_BASE = "https://api.razorpay.com/v1";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  /** Overridable for tests; defaults to the live API base. */
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Razorpay adapter (master §8). Implements the provider-neutral `PaymentProvider`
 * port. All network access is confined to this file; callers see only normalised
 * types. Signature verification and payload normalisation are delegated to the
 * pure helpers in `./razorpay-crypto` so they can be unit-tested without a
 * network and are shared verbatim by the in-memory test double.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";
  readonly enabled = true;

  protected readonly keyId: string;
  protected readonly keySecret: string;
  protected readonly webhookSecret: string;
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: RazorpayConfig) {
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
    this.webhookSecret = config.webhookSecret;
    this.apiBase = config.apiBase ?? API_BASE;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private authHeader(): string {
    const token = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    return `Basic ${token}`;
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
          Authorization: this.authHeader(),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ProviderApiError("razorpay", 0, (e as Error).message);
    }
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : {};
    if (!res.ok) {
      const detail =
        (json as { error?: { description?: string } })?.error?.description ??
        text ??
        res.statusText;
      throw new ProviderApiError("razorpay", res.status, detail);
    }
    return json as T;
  }

  async createOrder(input: CreateOrderInput): Promise<CreatedProviderOrder> {
    const order = await this.call<{
      id: string;
      amount: number;
      currency: string;
    }>("POST", "/orders", {
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: { ...input.notes, operation_key: input.operationKey },
    });
    return {
      providerOrderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      raw: order,
    };
  }

  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean {
    return pureVerifyCheckout({ ...input, keySecret: this.keySecret });
  }

  verifyWebhook(rawBody: Buffer, headers: Headers): VerifiedProviderWebhook {
    const signature = headers.get("x-razorpay-signature") ?? "";
    if (
      !pureVerifyWebhook({ rawBody, signature, webhookSecret: this.webhookSecret })
    ) {
      throw new WebhookVerificationError("razorpay webhook signature mismatch");
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new WebhookVerificationError("razorpay webhook body is not JSON");
    }
    const eventId =
      headers.get("x-razorpay-event-id") ??
      createHash("sha256").update(rawBody).digest("hex");
    return parseRazorpayWebhookBody(body, eventId);
  }

  async fetchPayment(providerPaymentId: string): Promise<NormalizedPayment> {
    const entity = await this.call<Parameters<typeof normalizeRazorpayPayment>[0]>(
      "GET",
      `/payments/${providerPaymentId}`,
    );
    return normalizeRazorpayPayment(entity);
  }

  async fetchOrderPayments(providerOrderId: string): Promise<NormalizedPayment[]> {
    const res = await this.call<{
      items: Parameters<typeof normalizeRazorpayPayment>[0][];
    }>("GET", `/orders/${providerOrderId}/payments`);
    return (res.items ?? []).map(normalizeRazorpayPayment);
  }

  async createRefund(input: CreateRefundInput): Promise<NormalizedRefund> {
    const entity = await this.call<Parameters<typeof normalizeRazorpayRefund>[0]>(
      "POST",
      `/payments/${input.providerPaymentId}/refund`,
      {
        amount: input.amountPaise,
        speed: "normal",
        notes: { ...input.notes, operation_key: input.operationKey },
      },
    );
    return normalizeRazorpayRefund(entity);
  }

  async fetchRefund(providerRefundId: string): Promise<NormalizedRefund> {
    const entity = await this.call<Parameters<typeof normalizeRazorpayRefund>[0]>(
      "GET",
      `/refunds/${providerRefundId}`,
    );
    return normalizeRazorpayRefund(entity);
  }
}

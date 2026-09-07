import "server-only";

/**
 * Provider-neutral payment boundary (master §8 "Payments").
 *
 * Every payment provider (Razorpay now; Cashfree is an interface-compatible
 * future adapter, disabled) implements this one interface. The rest of the app
 * — checkout actions, the webhook route, reconciliation jobs, admin refunds —
 * only ever sees the normalised local types below, never a provider's wire
 * shape. Provider network calls happen OUTSIDE database transactions.
 *
 * Non-negotiables encoded here:
 *  - Browser "success" is never proof of payment. `verifyCheckoutSignature`
 *    plus a server-side `fetchPayment` (amount, INR currency, captured state)
 *    are what confirm a prepaid order.
 *  - Webhooks are verified from RAW bytes with the provider's own mechanism.
 *  - Authorisation alone is insufficient for prepaid fulfilment.
 */

export class PaymentError extends Error {}

/** Provider is wired in code but disabled for this store (e.g. Cashfree). */
export class ProviderDisabledError extends PaymentError {
  constructor(provider: string) {
    super(`Payment provider "${provider}" is not enabled.`);
    this.name = "ProviderDisabledError";
  }
}

/** Provider is enabled but its credentials are absent in this environment. */
export class ProviderNotConfiguredError extends PaymentError {
  constructor(provider: string) {
    super(`Payment provider "${provider}" is not configured in this environment.`);
    this.name = "ProviderNotConfiguredError";
  }
}

/** The provider API returned an error (network, 4xx, 5xx). */
export class ProviderApiError extends PaymentError {
  constructor(
    provider: string,
    readonly httpStatus: number,
    readonly detail: string,
  ) {
    super(`${provider} API error (${httpStatus}): ${detail}`);
    this.name = "ProviderApiError";
  }
}

/** The customer-facing checkout callback failed a hard security check. */
export class PaymentVerificationError extends PaymentError {
  constructor(reason: string) {
    super(`Payment verification failed: ${reason}`);
    this.name = "PaymentVerificationError";
  }
}

/** Signature was valid but a server-known fact (amount/currency/order) did not match. */
export class PaymentMismatchError extends PaymentError {
  constructor(readonly mismatches: string[]) {
    super(`Payment does not match the order: ${mismatches.join(", ")}`);
    this.name = "PaymentMismatchError";
  }
}

/** A refund would exceed the captured amount (counting pending + completed). */
export class RefundLimitError extends PaymentError {
  constructor(readonly requestedPaise: number, readonly availablePaise: number) {
    super(
      `Refund of ${requestedPaise} paise exceeds the ${availablePaise} paise still refundable.`,
    );
    this.name = "RefundLimitError";
  }
}

export type NormalizedPaymentStatus =
  | "created"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded";

export interface NormalizedPayment {
  providerPaymentId: string;
  providerOrderId: string | null;
  status: NormalizedPaymentStatus;
  /** Amount the customer paid, in paise. */
  amountPaise: number;
  /** Paise actually captured — 0 unless `status === "captured"`. */
  capturedAmountPaise: number;
  amountRefundedPaise: number;
  currency: string;
  method: string | null;
  raw: unknown;
}

export type NormalizedRefundStatus = "pending" | "processed" | "failed";

export interface NormalizedRefund {
  providerRefundId: string;
  providerPaymentId: string;
  status: NormalizedRefundStatus;
  amountPaise: number;
  raw: unknown;
}

export interface CreatedProviderOrder {
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  raw: unknown;
}

export interface VerifiedProviderWebhook {
  /** Stable, provider-supplied event id used for inbox deduplication. */
  externalEventId: string;
  eventType: string;
  payment?: NormalizedPayment;
  refund?: NormalizedRefund;
  raw: unknown;
}

export interface CreateOrderInput {
  amountPaise: number;
  currency: "INR";
  /** Human-facing merchant reference — our order number. */
  receipt: string;
  /** Our operation key; correlates a provider order back to a PaymentAttempt. */
  operationKey: string;
  notes?: Record<string, string>;
}

export interface CreateRefundInput {
  providerPaymentId: string;
  amountPaise: number;
  /** Our `Refund.operationKey`; the local unique row is the real dedupe. */
  operationKey: string;
  notes?: Record<string, string>;
}

export interface PaymentProvider {
  readonly name: string;
  readonly enabled: boolean;

  createOrder(input: CreateOrderInput): Promise<CreatedProviderOrder>;

  /** Pure HMAC check of the browser checkout handoff. Never sufficient alone. */
  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean;

  /** Verify raw webhook bytes; throw `WebhookVerificationError` on failure. */
  verifyWebhook(rawBody: Buffer, headers: Headers): VerifiedProviderWebhook;

  fetchPayment(providerPaymentId: string): Promise<NormalizedPayment>;

  /** All payment attempts Razorpay recorded against one provider order. */
  fetchOrderPayments(providerOrderId: string): Promise<NormalizedPayment[]>;

  createRefund(input: CreateRefundInput): Promise<NormalizedRefund>;

  fetchRefund(providerRefundId: string): Promise<NormalizedRefund>;
}

import "server-only";

import {
  ProviderDisabledError,
  type CreateOrderInput,
  type CreateRefundInput,
  type CreatedProviderOrder,
  type NormalizedPayment,
  type NormalizedRefund,
  type PaymentProvider,
  type VerifiedProviderWebhook,
} from "./port";

/**
 * Cashfree is an interface-compatible FUTURE adapter (master §8, deferred-scope).
 * It is deliberately NOT a working fake integration — every operation throws
 * `ProviderDisabledError`. Its only job is to prove the port is provider-neutral
 * and to give a real class to swap in later.
 */
export class CashfreeProvider implements PaymentProvider {
  readonly name = "cashfree";
  readonly enabled = false;

  private fail(): never {
    throw new ProviderDisabledError("cashfree");
  }

  createOrder(input: CreateOrderInput): Promise<CreatedProviderOrder> {
    void input;
    return this.fail();
  }
  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean {
    void input;
    return this.fail();
  }
  verifyWebhook(rawBody: Buffer, headers: Headers): VerifiedProviderWebhook {
    void rawBody;
    void headers;
    return this.fail();
  }
  fetchPayment(providerPaymentId: string): Promise<NormalizedPayment> {
    void providerPaymentId;
    return this.fail();
  }
  fetchOrderPayments(providerOrderId: string): Promise<NormalizedPayment[]> {
    void providerOrderId;
    return this.fail();
  }
  createRefund(input: CreateRefundInput): Promise<NormalizedRefund> {
    void input;
    return this.fail();
  }
  fetchRefund(providerRefundId: string): Promise<NormalizedRefund> {
    void providerRefundId;
    return this.fail();
  }
}

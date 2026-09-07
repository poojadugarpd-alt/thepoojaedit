import "server-only";

/**
 * payments domain service (master §8). Provider-neutral orchestration lives in
 * `./service`; the Razorpay wire adapter in `./razorpay`; the port contract in
 * `./port`. This module selects the configured provider and binds the shared
 * Prisma client for route/action callers.
 */
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { publicEnv } from "@/lib/public-env";

import { CashfreeProvider } from "./cashfree";
import { ProviderNotConfiguredError, type PaymentProvider } from "./port";
import { RazorpayProvider } from "./razorpay";
import {
  createOrderRefund,
  createPaymentAttempt,
  handleProviderWebhook,
  verifyPrepaidCheckout,
} from "./service";

export * from "./port";
export {
  createPaymentAttempt,
  verifyPrepaidCheckout,
  handleProviderWebhook,
  makePaymentReconcilePort,
  createOrderRefund,
} from "./service";

/** Providers this store knows about. Only `razorpay` is enabled (Cashfree is a
 *  labelled, interface-compatible future adapter — deferred-scope). */
export const PAYMENT_PROVIDERS = [
  { name: "razorpay", enabled: true },
  { name: "cashfree", enabled: false },
] as const;

/** True when prepaid checkout can actually run in this environment. */
export function isPrepaidConfigured(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID &&
      env.RAZORPAY_KEY_SECRET &&
      env.RAZORPAY_WEBHOOK_SECRET,
  );
}

let cached: PaymentProvider | null = null;

/** The configured provider, or throw a clear error if keys are absent. */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  if (!isPrepaidConfigured()) throw new ProviderNotConfiguredError("razorpay");
  cached = new RazorpayProvider({
    keyId: publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    keySecret: env.RAZORPAY_KEY_SECRET!,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET!,
  });
  return cached;
}

/** The disabled future adapter, for interface-compatibility checks/tests. */
export function getDisabledProvider(): PaymentProvider {
  return new CashfreeProvider();
}

// ── thin Prisma-bound wrappers for routes / server actions ──────────────────

export function startPrepaidPayment(orderId: string) {
  return createPaymentAttempt(prisma, getPaymentProvider(), { orderId });
}

export function confirmPrepaidCheckout(input: {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}) {
  return verifyPrepaidCheckout(prisma, getPaymentProvider(), input);
}

export function ingestRazorpayWebhook(input: { rawBody: Buffer; headers: Headers }) {
  return handleProviderWebhook(prisma, getPaymentProvider(), input);
}

export function refundOrder(input: {
  orderId: string;
  amountPaise: number;
  reason?: string;
  requestedByAdminId?: string;
  actor?: string;
  operationKey?: string;
}) {
  return createOrderRefund(prisma, getPaymentProvider(), input);
}

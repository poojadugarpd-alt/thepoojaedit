"use client";

/**
 * Razorpay Checkout (client) loader. The script is only fetched when the
 * customer actually chooses to pay; nothing here runs on the server.
 * https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (payload: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      loading = null;
      reject(new Error("Failed to load Razorpay Checkout"));
    };
    document.head.appendChild(el);
  });
  return loading;
}

export interface OpenCheckoutArgs {
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (r: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss?: () => void;
  onFailed?: (payload: unknown) => void;
}

export async function openRazorpayCheckout(args: OpenCheckoutArgs): Promise<void> {
  await loadRazorpay();
  if (!window.Razorpay) throw new Error("Razorpay Checkout unavailable");
  const rzp = new window.Razorpay({
    key: args.keyId,
    amount: args.amountPaise,
    currency: "INR",
    name: "The Pooja Edit",
    description: "Order payment",
    order_id: args.providerOrderId,
    prefill: args.prefill,
    theme: { color: "#111111" },
    handler: args.onSuccess,
    modal: { ondismiss: args.onDismiss },
  });
  if (args.onFailed) rzp.on("payment.failed", args.onFailed);
  rzp.open();
}

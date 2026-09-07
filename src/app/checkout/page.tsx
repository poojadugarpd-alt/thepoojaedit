import type { Metadata } from "next";

import { CheckoutClient } from "@/features/checkout/checkout-client";
import { isPrepaidConfigured } from "@/server/payments";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

/**
 * Authoritative checkout (master §7). The cart lives in the browser, so the flow
 * is client-driven, but every price, tax figure and reservation is computed and
 * enforced on the server (`prepareCheckoutAction` / `placeCheckoutAction`).
 * Prepaid uses Razorpay Checkout; COD is a distinct path that is never shown as
 * paid.
 */
export default function CheckoutPage() {
  return <CheckoutClient prepaidEnabled={isPrepaidConfigured()} />;
}

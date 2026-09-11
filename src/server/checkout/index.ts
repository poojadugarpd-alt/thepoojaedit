import "server-only";

/**
 * Checkout domain service. Logic lives in `./quote` and `./place-order`; this
 * module binds the shared Prisma client for route/action callers.
 */
import { prisma } from "@/lib/db";

import { computeQuote, type QuoteInput } from "./quote";
import { placeOrder, type PlaceOrderInput } from "./place-order";

export * from "./quote";
export * from "./place-order";

/**
 * Storefront policy: Cash on Delivery is turned off at the web checkout
 * (owner request, 2026-09-11). This is a checkout-entry-point gate, not a
 * domain rule — `placeOrder`/`computeQuote` still accept `paymentMethod: "COD"`
 * unchanged, so admin tooling, the order state machine and existing COD orders
 * keep working. Flip this back to `true` to re-offer COD at checkout.
 */
export const CHECKOUT_COD_ENABLED = false;

export function getQuote(input: QuoteInput) {
  return computeQuote(prisma, input);
}

export function checkout(input: PlaceOrderInput) {
  return placeOrder(prisma, input);
}

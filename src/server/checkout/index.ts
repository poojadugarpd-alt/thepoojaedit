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

export function getQuote(input: QuoteInput) {
  return computeQuote(prisma, input);
}

export function checkout(input: PlaceOrderInput) {
  return placeOrder(prisma, input);
}

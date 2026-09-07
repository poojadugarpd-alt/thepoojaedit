import "server-only";

/**
 * Orders domain service. Lifecycle transitions live in `./lifecycle`, the state
 * machines in `./state`, guest access in `./access-tokens`. This module binds
 * the shared Prisma client and exposes a read for the order-view page.
 */
import type { PrismaClient } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { assertOwnsOrder } from "@/server/admin/guards";
import { ResourceNotFoundError } from "@/server/auth/errors";

import { verifyOrderAccessToken } from "./access-tokens";

export * from "./lifecycle";
export * from "./state";
export { generateOrderNumber } from "./order-number";

const ORDER_VIEW_INCLUDE = {
  items: { orderBy: { createdAt: "asc" } },
  addresses: true,
  events: { orderBy: { createdAt: "asc" } },
} as const;

/**
 * Resolve an order for a viewer: a signed-in customer who owns it, or a guest
 * holding a valid ORDER_VIEW token. Anything else is a generic "not found"
 * (master §9 — resist enumeration).
 */
export async function getViewableOrder(
  db: PrismaClient,
  input:
    | { orderNumber: string; token: string }
    | { orderNumber: string; customerId: string },
) {
  const order = await db.order.findUnique({
    where: { orderNumber: input.orderNumber },
    include: ORDER_VIEW_INCLUDE,
  });
  if (!order) throw new ResourceNotFoundError();

  if ("token" in input) {
    await verifyOrderAccessToken(db, {
      token: input.token,
      scope: "ORDER_VIEW",
      orderId: order.id,
    });
  } else {
    await assertOwnsOrder(db, input.customerId, order.id);
  }
  return order;
}

export function getViewableOrderForGuest(orderNumber: string, token: string) {
  return getViewableOrder(prisma, { orderNumber, token });
}
export function getViewableOrderForCustomer(orderNumber: string, customerId: string) {
  return getViewableOrder(prisma, { orderNumber, customerId });
}

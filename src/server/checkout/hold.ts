import "server-only";

import type { PrismaClient } from "@/generated/prisma";
import { InsufficientStockError } from "@/server/inventory/errors";
import { renewHold } from "@/server/inventory/reservations";
import { cancelOrder } from "@/server/orders/lifecycle";
import { getCheckoutRules } from "@/server/settings";

export const SOLD_WHILE_UNPAID_REASON = "the piece sold before the payment was made";

/** Razorpay Checkout closes this long before the hold ends, so a payment the
 *  buyer finishes at the last second still lands while the stock is held. */
export const PAYMENT_WINDOW_MARGIN_SECONDS = 30;

export type HoldForPayment =
  | { ok: true; paymentWindowSeconds: number }
  | { ok: false; reason: "sold_out" | "not_awaiting_payment" };

/**
 * Before Razorpay Checkout opens (D-150): make sure the order's stock is held
 * (`renewHold`) and work out how long the payment window may stay open. If the
 * stock was bought by someone else while this order sat unpaid, the order is
 * cancelled (its "cancelled" email goes out) instead of taking a payment that
 * could only be refunded.
 */
export async function holdForPayment(
  db: PrismaClient,
  input: { orderId: string; now?: Date },
): Promise<HoldForPayment> {
  const now = input.now ?? new Date();
  const rules = await getCheckoutRules(db);
  try {
    const endsAt = await db.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
      if (order.orderStatus !== "PENDING_PAYMENT") return "not_awaiting_payment" as const;
      return renewHold(tx, {
        orderId: order.id,
        ttlSeconds: rules.reservationTtlSeconds,
        now,
      });
    });
    if (endsAt === "not_awaiting_payment") return { ok: false, reason: endsAt };
    const secondsLeft = endsAt
      ? Math.floor((endsAt.getTime() - now.getTime()) / 1000)
      : rules.reservationTtlSeconds;
    return {
      ok: true,
      paymentWindowSeconds: Math.max(60, secondsLeft - PAYMENT_WINDOW_MARGIN_SECONDS),
    };
  } catch (e) {
    if (!(e instanceof InsufficientStockError)) throw e;
    await cancelOrder(db, { orderId: input.orderId, reason: SOLD_WHILE_UNPAID_REASON });
    return { ok: false, reason: "sold_out" };
  }
}

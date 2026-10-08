import "server-only";

import type { Order, PrismaClient } from "@/generated/prisma";
import {
  openOperationalTask,
  resolveOperationalTask,
} from "@/server/events/operational-tasks";
import { cancelCodAllocation } from "@/server/inventory/cod";
import { InsufficientStockError } from "@/server/inventory/errors";
import {
  convertReservations,
  reacquireForLateCapture,
  releaseReservations,
} from "@/server/inventory/reservations";

import { assertTransition, ORDER_TRANSITIONS, type OrderStatus } from "./state";
import { appendOrderTimeline } from "./timeline";

function timeline(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  orderId: string,
  type: string,
  payload: Record<string, unknown>,
  actor?: string,
) {
  return appendOrderTimeline(tx, { orderId, type, payload, actor });
}

/** Timeline type written at placement when Shadowfax's PIN check errored. */
export const SERVICEABILITY_UNCONFIRMED = "checkout.serviceability_unconfirmed";

export const serviceabilityTaskKey = (orderId: string) =>
  `serviceability-unconfirmed:${orderId}`;

/**
 * Once an order is confirmed, turn a placement-time "PIN not confirmed" note
 * into a Needs Attention task, so it is checked before packing. Cleared when a
 * shipment is booked or linked, or the order is cancelled.
 */
async function raiseUnconfirmedServiceability(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  orderId: string,
): Promise<void> {
  const note = await tx.orderEvent.findFirst({
    where: { orderId, type: SERVICEABILITY_UNCONFIRMED },
  });
  if (!note) return;
  const postcode = (note.payload as { postcode?: string } | null)?.postcode ?? "?";
  await openOperationalTask(tx, {
    dedupeKey: serviceabilityTaskKey(orderId),
    type: "SHIPMENT_FAILURE",
    entityType: "Order",
    entityId: orderId,
    priority: 1,
    reason: `Shadowfax couldn't confirm delivery to PIN ${postcode} at checkout. Check it before packing; if they don't serve it, book it on Delhivery and enter the AWB in Admin → Other courier.`,
  });
}

/** COD acceptance → confirmed. Idempotent. Fulfillment becomes possible. */
export async function confirmCodOrder(
  db: PrismaClient,
  input: { orderId: string; actor?: string },
): Promise<Order> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
    if (order.paymentMethod !== "COD") {
      throw new Error("confirmCodOrder is only for COD orders.");
    }
    if (order.orderStatus === "CONFIRMED") return order;
    assertTransition(
      "order",
      ORDER_TRANSITIONS,
      order.orderStatus as OrderStatus,
      "CONFIRMED",
    );

    const updated = await tx.order.update({
      where: { id: order.id, version: order.version },
      data: {
        orderStatus: "CONFIRMED",
        confirmedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await timeline(
      tx,
      order.id,
      "order.cod_confirmed",
      { orderNumber: order.orderNumber },
      input.actor,
    );
    await raiseUnconfirmedServiceability(tx, order.id);
    return updated;
  });
}

/**
 * Cancel an unshipped order. Releases prepaid reservations or restores COD
 * committed stock exactly once. Does NOT issue a refund — that is a separate,
 * authorised flow (Phase 9).
 */
export async function cancelOrder(
  db: PrismaClient,
  input: {
    orderId: string;
    reason: string;
    actor?: string;
    /** false = no "order cancelled" email/WhatsApp (an abandoned checkout). */
    notifyCustomer?: boolean;
  },
): Promise<Order> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
    if (order.orderStatus === "CANCELLED") return order;
    // PROCESSING = a pickup was booked but nothing has moved yet; cancellable
    // once every shipment is cancelled with the carrier (D-133).
    const activeShipments =
      order.fulfillmentStatus === "PROCESSING"
        ? await tx.shipment.count({
            where: { orderId: order.id, statusNormalized: { not: "CANCELLED" } },
          })
        : 0;
    if (
      order.fulfillmentStatus !== "UNFULFILLED" &&
      !(order.fulfillmentStatus === "PROCESSING" && activeShipments === 0)
    ) {
      throw new Error(
        order.fulfillmentStatus === "PROCESSING"
          ? "This order has a booked shipment — cancel it with the carrier first."
          : "Only an unshipped order can be cancelled here.",
      );
    }
    assertTransition(
      "order",
      ORDER_TRANSITIONS,
      order.orderStatus as OrderStatus,
      "CANCELLED",
    );

    if (order.paymentMethod === "COD") {
      await cancelCodAllocation(tx, { orderId: order.id, reason: input.reason });
    } else {
      await releaseReservations(tx, { orderId: order.id, reason: input.reason });
    }

    const updated = await tx.order.update({
      where: { id: order.id, version: order.version },
      data: {
        orderStatus: "CANCELLED",
        fulfillmentStatus: "CANCELLED",
        cancelledAt: new Date(),
        version: { increment: 1 },
      },
    });
    // Gives a limited discount code's use back (D-140).
    await tx.discountRedemption.updateMany({
      where: { orderId: order.id, releasedAt: null },
      data: { releasedAt: new Date() },
    });
    await timeline(
      tx,
      order.id,
      "order.cancelled",
      {
        reason: input.reason,
        ...(input.notifyCustomer === false ? { notifyCustomer: false } : {}),
      },
      input.actor,
    );
    await resolveOperationalTask(tx, serviceabilityTaskKey(order.id));
    return updated;
  });
}

/**
 * Verified captured payment → convert reservations, confirm the order (master
 * §7.5). If the reservations already expired (late capture, §7.7): try to
 * re-acquire every item; on success confirm, on shortfall mark NEEDS_REVIEW and
 * block fulfillment. Never hides a real payment as failed.
 */
export async function settleCapturedPayment(
  db: PrismaClient,
  input: { orderId: string; capturedAmountPaise: number; now?: Date },
): Promise<{ order: Order; outcome: "converted" | "reacquired" | "needs_review" }> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });

    // Money arrived for an order that was already cancelled (e.g. an unpaid
    // checkout auto-cancelled after 30 min, then a slow UPI payment captured).
    // Never revive it: hand it to the late-capture refund (D-150), which
    // refunds in full and cancels it again. Its fulfilment was CANCELLED, so it
    // is reset to UNFULFILLED for that consumer; nothing ships from here.
    if (order.orderStatus === "CANCELLED") {
      const updated = await tx.order.update({
        where: { id: order.id, version: order.version },
        data: {
          orderStatus: "NEEDS_REVIEW",
          paymentStatus: "PAID",
          fulfillmentStatus: "UNFULFILLED",
          version: { increment: 1 },
        },
      });
      await timeline(tx, order.id, "order.late_capture_review", {
        capturedAmountPaise: input.capturedAmountPaise,
        note: "payment captured after the order was cancelled; refund required",
      });
      return { order: updated, outcome: "needs_review" as const };
    }

    const lines = await tx.orderItem.findMany({
      where: { orderId: order.id, variantId: { not: null } },
      select: { variantId: true, quantity: true },
    });
    const reserveLines = lines.map((l) => ({
      variantId: l.variantId!,
      quantity: l.quantity,
    }));

    let outcome: "converted" | "reacquired" | "needs_review";
    try {
      await convertReservations(tx, { orderId: order.id, now: input.now });
      outcome = "converted";
    } catch (e) {
      // Reservations no longer ACTIVE → late capture.
      try {
        await reacquireForLateCapture(tx, { orderId: order.id, lines: reserveLines });
        outcome = "reacquired";
      } catch (e2) {
        if (!(e2 instanceof InsufficientStockError)) throw e2;
        const updated = await tx.order.update({
          where: { id: order.id, version: order.version },
          data: {
            orderStatus: "NEEDS_REVIEW",
            paymentStatus: "PAID",
            version: { increment: 1 },
          },
        });
        await timeline(tx, order.id, "order.late_capture_review", {
          capturedAmountPaise: input.capturedAmountPaise,
          note: "stock reallocated before capture; fulfillment blocked, refund/review required",
        });
        return { order: updated, outcome: "needs_review" as const };
      }
      void e;
    }

    const updated = await tx.order.update({
      where: { id: order.id, version: order.version },
      data: {
        orderStatus: "CONFIRMED",
        paymentStatus: "PAID",
        confirmedAt: order.confirmedAt ?? new Date(),
        version: { increment: 1 },
      },
    });
    await timeline(tx, order.id, "order.payment_settled", {
      outcome,
      capturedAmountPaise: input.capturedAmountPaise,
    });
    await raiseUnconfirmedServiceability(tx, order.id);
    return { order: updated, outcome };
  });
}

/** Unpaid online checkouts older than this are cancelled automatically. */
export const ABANDONED_CHECKOUT_MINUTES = 30;
export const ABANDONED_CHECKOUT_REASON = "Not paid within 30 minutes (automatic)";

/**
 * Cancel prepaid checkouts still unpaid 30 minutes after they started, so
 * they leave Unpaid checkouts and the Overview. The customer is not emailed.
 * Skips any order with a payment that is authorised or captured (that one is
 * settling, not abandoned). Stock holds were already released at 10 minutes;
 * releasing again is a no-op. A payment that still lands later is refunded
 * automatically (see `settleCapturedPayment`).
 */
export async function cancelAbandonedCheckouts(
  db: PrismaClient,
  input: { now?: Date; limit?: number } = {},
): Promise<{ cancelled: string[] }> {
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - ABANDONED_CHECKOUT_MINUTES * 60_000);
  const stale = await db.order.findMany({
    where: {
      paymentMethod: "PREPAID_RAZORPAY",
      orderStatus: "PENDING_PAYMENT",
      paymentStatus: { in: ["UNPAID", "PENDING", "FAILED"] },
      placedAt: { lt: cutoff },
      paymentAttempts: { none: { status: { in: ["AUTHORIZED", "CAPTURED"] } } },
    },
    select: { id: true, orderNumber: true },
    orderBy: { placedAt: "asc" },
    take: input.limit ?? 50,
  });
  const cancelled: string[] = [];
  for (const o of stale) {
    try {
      await cancelOrder(db, {
        orderId: o.id,
        reason: ABANDONED_CHECKOUT_REASON,
        notifyCustomer: false,
      });
      cancelled.push(o.orderNumber);
    } catch {
      // Raced with a payment or a manual action — leave it for the next run.
    }
  }
  return { cancelled };
}

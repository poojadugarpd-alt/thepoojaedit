import "server-only";

import type { Order, PrismaClient } from "@/generated/prisma";
import { emitDomainEvent } from "@/server/events/emit";
import { cancelCodAllocation } from "@/server/inventory/cod";
import { InsufficientStockError } from "@/server/inventory/errors";
import {
  convertReservations,
  reacquireForLateCapture,
  releaseReservations,
} from "@/server/inventory/reservations";

import { assertTransition, ORDER_TRANSITIONS, type OrderStatus } from "./state";

async function timeline(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  orderId: string,
  type: string,
  payload: Record<string, unknown>,
  actor?: string,
) {
  await tx.orderEvent.create({
    data: {
      orderId,
      type,
      source: actor ? "admin" : "system",
      actor: actor ?? null,
      payload: payload as Record<string, never>,
    },
  });
  await emitDomainEvent(tx, {
    type,
    aggregateType: "Order",
    aggregateId: orderId,
    payload,
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
  input: { orderId: string; reason: string; actor?: string },
): Promise<Order> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
    if (order.orderStatus === "CANCELLED") return order;
    if (order.fulfillmentStatus !== "UNFULFILLED") {
      throw new Error("Only an unshipped order can be cancelled here.");
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
    await timeline(
      tx,
      order.id,
      "order.cancelled",
      { reason: input.reason },
      input.actor,
    );
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
    return { order: updated, outcome };
  });
}

import "server-only";

import type { PrismaClient, ReturnRequest } from "@/generated/prisma";
import { restockUnits } from "@/server/inventory/restock";
import { assertTransition, RETURN_TRANSITIONS, type ReturnStatus } from "@/server/orders/state";
import { appendOrderTimeline } from "@/server/orders/timeline";
import { requestRefund } from "@/server/refunds/service";
import type { PaymentProvider } from "@/server/payments";

/**
 * Returns lifecycle (master §7, §8). Physical restock happens ONLY on an
 * explicit `RESTOCK` inspection outcome, exactly once (ledger key
 * `return-restock:<returnItemId>`), never inferred from a refund. Every admin
 * step is audited.
 */
export class ReturnError extends Error {}

export async function createReturnRequest(
  db: PrismaClient,
  input: {
    orderId: string;
    reason: string;
    items: { orderItemId: string; quantity: number }[];
    requestedByCustomerId?: string | null;
  },
): Promise<ReturnRequest> {
  if (input.items.length === 0) throw new ReturnError("No items to return.");

  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: input.orderId },
      include: { items: true },
    });
    if (order.fulfillmentStatus !== "DELIVERED") {
      throw new ReturnError("Only a delivered order can be returned.");
    }

    const alreadyReturned = await tx.returnItem.groupBy({
      by: ["orderItemId"],
      where: { returnRequest: { orderId: input.orderId, status: { not: "REJECTED" } } },
      _sum: { quantity: true },
    });
    const returnedByItem = new Map(
      alreadyReturned.map((r) => [r.orderItemId, r._sum.quantity ?? 0]),
    );

    for (const line of input.items) {
      const oi = order.items.find((i) => i.id === line.orderItemId);
      if (!oi) throw new ReturnError("Line is not part of this order.");
      const policy = (oi.returnPolicySnapshot ?? {}) as { finalSale?: boolean };
      if (policy.finalSale) {
        throw new ReturnError(`"${oi.title}" is final sale and cannot be returned.`);
      }
      const remaining = oi.quantity - (returnedByItem.get(oi.id) ?? 0);
      if (line.quantity <= 0 || line.quantity > remaining) {
        throw new ReturnError(`Invalid return quantity for "${oi.title}".`);
      }
    }

    const rr = await tx.returnRequest.create({
      data: {
        orderId: input.orderId,
        reason: input.reason,
        status: "REQUESTED",
        items: {
          create: input.items.map((l) => ({
            orderItemId: l.orderItemId,
            quantity: l.quantity,
          })),
        },
      },
    });
    await appendOrderTimeline(tx, {
      orderId: input.orderId,
      type: "return.requested",
      payload: { returnRequestId: rr.id, reason: input.reason },
      actor: input.requestedByCustomerId ?? undefined,
    });
    return rr;
  });
}

async function transitionReturn(
  db: PrismaClient,
  returnRequestId: string,
  to: ReturnStatus,
  adminUserId: string,
  extra: { adminNotes?: string; resolution?: "REFUND" | "REPLACEMENT" | "REJECTED" } = {},
): Promise<ReturnRequest> {
  return db.$transaction(async (tx) => {
    const rr = await tx.returnRequest.findUniqueOrThrow({ where: { id: returnRequestId } });
    assertTransition("return", RETURN_TRANSITIONS, rr.status as ReturnStatus, to);
    const updated = await tx.returnRequest.update({
      where: { id: rr.id },
      data: {
        status: to,
        handledById: adminUserId,
        adminNotes: extra.adminNotes ?? rr.adminNotes,
        resolution: extra.resolution ?? rr.resolution,
      },
    });
    await tx.adminActivityLog.create({
      data: {
        adminUserId,
        action: `return.${to.toLowerCase()}`,
        entityType: "ReturnRequest",
        entityId: rr.id,
        reason: extra.adminNotes ?? null,
      },
    });
    await appendOrderTimeline(tx, {
      orderId: rr.orderId,
      type: `return.${to.toLowerCase()}`,
      payload: { returnRequestId: rr.id, resolution: extra.resolution ?? null },
      actor: adminUserId,
    });
    return updated;
  });
}

export function decideReturn(
  db: PrismaClient,
  input: { returnRequestId: string; approve: boolean; adminUserId: string; notes?: string },
) {
  return transitionReturn(
    db,
    input.returnRequestId,
    input.approve ? "APPROVED" : "REJECTED",
    input.adminUserId,
    { adminNotes: input.notes },
  );
}

export function markReturnInTransit(
  db: PrismaClient,
  input: { returnRequestId: string; adminUserId: string },
) {
  return transitionReturn(db, input.returnRequestId, "IN_TRANSIT", input.adminUserId);
}

export function markReturnReceived(
  db: PrismaClient,
  input: { returnRequestId: string; adminUserId: string },
) {
  return transitionReturn(db, input.returnRequestId, "RECEIVED", input.adminUserId);
}

/**
 * Inspect one returned line. `RESTOCK` adds the units back to on-hand exactly
 * once; a repeat inspection of the same line restocks nothing.
 */
export async function inspectReturnItem(
  db: PrismaClient,
  input: {
    returnItemId: string;
    outcome: "RESTOCK" | "DAMAGED_DISCARD";
    conditionNotes?: string;
    adminUserId: string;
  },
): Promise<{ restocked: boolean }> {
  return db.$transaction(async (tx) => {
    const item = await tx.returnItem.findUniqueOrThrow({
      where: { id: input.returnItemId },
      include: { returnRequest: true, orderItem: true },
    });
    if (!["RECEIVED", "INSPECTED"].includes(item.returnRequest.status)) {
      throw new ReturnError(
        `Return is ${item.returnRequest.status}; inspection needs RECEIVED.`,
      );
    }

    let restocked = false;
    if (input.outcome === "RESTOCK") {
      if (!item.orderItem.variantId) {
        throw new ReturnError("Return line has no variant to restock.");
      }
      const r = await restockUnits(tx, {
        keyScope: `return-restock:${item.id}`,
        txnType: "RETURN_RESTOCK",
        lines: [
          {
            variantId: item.orderItem.variantId,
            quantity: item.quantity,
            orderId: item.returnRequest.orderId,
          },
        ],
        reason: `return inspected: ${input.conditionNotes ?? "resellable"}`,
      });
      restocked = r.restockedVariants > 0;
    }

    await tx.returnItem.update({
      where: { id: item.id },
      data: {
        inspectionOutcome: input.outcome,
        conditionNotes: input.conditionNotes ?? item.conditionNotes,
        restockedAt: input.outcome === "RESTOCK" ? new Date() : item.restockedAt,
      },
    });
    await tx.adminActivityLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: "return.item_inspected",
        entityType: "ReturnItem",
        entityId: item.id,
        after: { outcome: input.outcome, restocked },
        reason: input.conditionNotes ?? null,
      },
    });
    return { restocked };
  });
}

export function finalizeReturnInspection(
  db: PrismaClient,
  input: { returnRequestId: string; adminUserId: string },
) {
  return transitionReturn(db, input.returnRequestId, "INSPECTED", input.adminUserId);
}

/**
 * Resolve an inspected return. `REFUND` computes the refundable line value
 * (unit total incl. tax × returned qty) and hands it to the refund workflow —
 * which enforces the aggregate limit. Restock is NOT triggered here.
 */
export async function resolveReturn(
  db: PrismaClient,
  provider: PaymentProvider,
  input: {
    returnRequestId: string;
    resolution: "REFUND" | "REPLACEMENT" | "REJECTED";
    adminUserId: string;
  },
): Promise<ReturnRequest> {
  const rr = await db.returnRequest.findUniqueOrThrow({
    where: { id: input.returnRequestId },
    include: { items: { include: { orderItem: true } } },
  });

  const resolved = await transitionReturn(
    db,
    input.returnRequestId,
    "RESOLVED",
    input.adminUserId,
    { resolution: input.resolution },
  );

  if (input.resolution === "REFUND") {
    const amountPaise = rr.items.reduce((sum, ri) => {
      const perUnit = Math.round(ri.orderItem.totalPaise / Math.max(1, ri.orderItem.quantity));
      return sum + perUnit * ri.quantity;
    }, 0);
    if (amountPaise > 0) {
      await requestRefund(db, provider, {
        orderId: rr.orderId,
        amountPaise,
        reason: `Return ${rr.id}`,
        adminUserId: input.adminUserId,
        creditNoteReason: "RETURN",
        operationKey: `return-refund:${rr.id}`,
      });
    }
  }
  return resolved;
}

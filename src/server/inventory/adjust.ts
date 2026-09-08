import "server-only";

import type { PrismaClient } from "@/generated/prisma";
import { openOperationalTask, resolveOperationalTask } from "@/server/events/operational-tasks";

import { InsufficientStockError } from "./errors";

/**
 * Reasoned on-hand correction (master §10 — "reasoned corrections … no
 * unrestricted quantity field that bypasses invariants"). A delta may be
 * negative but can never drive `onHandQty` below `reservedQty` (the Phase 2
 * CHECK is the backstop) or below 0. Every call writes an immutable
 * `InventoryTransaction` (`ADJUST`, with the admin id + reason) and an
 * `AdminActivityLog` entry, and re-evaluates the low-stock task for the variant.
 */
export class AdjustmentError extends Error {}

export async function adjustStock(
  db: PrismaClient,
  input: {
    variantId: string;
    /** signed change to on-hand */
    delta: number;
    reason: string;
    adminUserId: string;
  },
): Promise<{ onHandQty: number; availableQty: number }> {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new AdjustmentError("Adjustment must be a non-zero whole number.");
  }
  if (!input.reason.trim()) {
    throw new AdjustmentError("A reason is required for a stock correction.");
  }

  const result = await db.$transaction(async (tx) => {
    const before = await tx.productVariant.findUniqueOrThrow({
      where: { id: input.variantId },
      select: { onHandQty: true, reservedQty: true, lowStockThreshold: true, sku: true },
    });
    const nextOnHand = before.onHandQty + input.delta;
    if (nextOnHand < 0 || nextOnHand < before.reservedQty) {
      throw new InsufficientStockError(input.variantId);
    }

    const affected = await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant"
         SET "onHandQty" = "onHandQty" + $2::int, "updatedAt" = now()
       WHERE "id" = $1::uuid
         AND "onHandQty" + $2::int >= 0
         AND "onHandQty" + $2::int >= "reservedQty"`,
      input.variantId,
      input.delta,
    );
    if (affected === 0) throw new InsufficientStockError(input.variantId);

    await tx.inventoryTransaction.create({
      data: {
        variantId: input.variantId,
        adminUserId: input.adminUserId,
        type: "ADJUST",
        onHandDelta: input.delta,
        reservedDelta: 0,
        reason: input.reason,
        idempotencyKey: `adjust:${input.variantId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    await tx.adminActivityLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: "inventory.adjust",
        entityType: "ProductVariant",
        entityId: input.variantId,
        before: { onHandQty: before.onHandQty },
        after: { onHandQty: nextOnHand },
        reason: input.reason,
      },
    });

    const availableQty = nextOnHand - before.reservedQty;
    return { onHandQty: nextOnHand, availableQty, threshold: before.lowStockThreshold };
  });

  // low-stock task lifecycle
  if (result.threshold > 0 && result.availableQty <= result.threshold) {
    await openOperationalTask(db, {
      dedupeKey: `low-stock:${input.variantId}`,
      type: "LOW_STOCK",
      entityType: "ProductVariant",
      entityId: input.variantId,
      priority: 3,
      reason: `available ${result.availableQty} ≤ threshold ${result.threshold}`,
    });
  } else {
    await resolveOperationalTask(db, `low-stock:${input.variantId}`);
  }

  return { onHandQty: result.onHandQty, availableQty: result.availableQty };
}

export interface LedgerRow {
  id: string;
  type: string;
  onHandDelta: number;
  reservedDelta: number;
  reason: string | null;
  orderId: string | null;
  adminUserId: string | null;
  createdAt: Date;
}

export async function listVariantLedger(
  db: PrismaClient,
  variantId: string,
  limit = 50,
): Promise<LedgerRow[]> {
  return db.inventoryTransaction.findMany({
    where: { variantId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    select: {
      id: true,
      type: true,
      onHandDelta: true,
      reservedDelta: true,
      reason: true,
      orderId: true,
      adminUserId: true,
      createdAt: true,
    },
  });
}

import "server-only";

import { InsufficientStockError } from "./errors";
import type { ReserveLine, Tx } from "./reservations";

/**
 * COD stock (master spec §7). At COD acceptance the stock is allocated straight
 * into committed order stock — on-hand is decremented, no prepaid-expiry
 * reservation remains. The order stays PENDING_CONFIRMATION / payment
 * COD_PENDING (the status transitions live in orders/state).
 */

const key = (parts: string[]) => parts.join(":");

async function tryLedger(
  tx: Tx,
  data: {
    variantId: string;
    orderId: string;
    type: "COD_ALLOCATE" | "COD_CANCEL";
    onHandDelta: number;
    idempotencyKey: string;
    reason?: string;
  },
): Promise<boolean> {
  try {
    await tx.inventoryTransaction.create({
      data: {
        variantId: data.variantId,
        orderId: data.orderId,
        type: data.type,
        onHandDelta: data.onHandDelta,
        reservedDelta: 0,
        reason: data.reason,
        idempotencyKey: data.idempotencyKey,
      },
    });
    return true;
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return false;
    throw e;
  }
}

/** All-or-nothing committed-stock allocation for a COD order. */
export async function allocateCodStock(
  tx: Tx,
  input: { orderId: string; lines: ReserveLine[] },
): Promise<void> {
  const lines = [...input.lines]
    .filter((l) => l.quantity > 0)
    .sort((a, b) => a.variantId.localeCompare(b.variantId));

  for (const line of lines) {
    const affected = await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant"
         SET "onHandQty" = "onHandQty" - $2::int, "updatedAt" = now()
       WHERE "id" = $1::uuid
         AND "isActive" = true
         AND ("onHandQty" - "reservedQty") >= $2::int`,
      line.variantId,
      line.quantity,
    );
    if (affected === 0) throw new InsufficientStockError(line.variantId);
    await tryLedger(tx, {
      variantId: line.variantId,
      orderId: input.orderId,
      type: "COD_ALLOCATE",
      onHandDelta: -line.quantity,
      idempotencyKey: key(["cod-alloc", input.orderId, line.variantId]),
    });
  }
}

/**
 * Restore unshipped committed stock for a cancelled COD order — exactly once.
 * Idempotency is enforced by the ledger's unique `cod-cancel:<order>:<variant>`
 * key; a repeat call restores nothing.
 */
export async function cancelCodAllocation(
  tx: Tx,
  input: { orderId: string; reason?: string },
): Promise<number> {
  const allocations = await tx.inventoryTransaction.findMany({
    where: { orderId: input.orderId, type: "COD_ALLOCATE" },
    select: { variantId: true, onHandDelta: true },
  });

  let restored = 0;
  for (const a of allocations) {
    const qty = Math.abs(a.onHandDelta);
    const first = await tryLedger(tx, {
      variantId: a.variantId,
      orderId: input.orderId,
      type: "COD_CANCEL",
      onHandDelta: qty,
      idempotencyKey: key(["cod-cancel", input.orderId, a.variantId]),
      reason: input.reason,
    });
    if (!first) continue; // already restored
    await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant"
         SET "onHandQty" = "onHandQty" + $2::int, "updatedAt" = now()
       WHERE "id" = $1::uuid`,
      a.variantId,
      qty,
    );
    restored++;
  }
  return restored;
}

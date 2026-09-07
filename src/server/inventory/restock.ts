import "server-only";

import type { Prisma } from "@/generated/prisma";

type Tx = Prisma.TransactionClient;

const key = (parts: string[]) => parts.join(":");

/**
 * Add units back to on-hand stock after an AUTHORISED physical return / inspected
 * RTO (master §7 — "Restock only after an authorized cancellation of unshipped
 * goods or physical return/RTO inspection, exactly once"). Idempotent: the
 * `InventoryTransaction` unique key (`<keyScope>:<variantId>`) makes a repeat
 * call a no-op, so a duplicate inspection cannot create a second physical copy —
 * including one-of-one thrift pieces (the DB one-of-one trigger is the backstop).
 *
 * Never called from an RTO-in-transit webhook — only from an explicit inspection.
 */
export async function restockUnits(
  tx: Tx,
  input: {
    /** e.g. `rto-restock:<shipmentId>` or `return-restock:<returnId>`. */
    keyScope: string;
    txnType: "RTO_RESTOCK" | "RETURN_RESTOCK";
    lines: { variantId: string; quantity: number; orderId?: string | null }[];
    reason?: string;
  },
): Promise<{ restockedVariants: number }> {
  let restockedVariants = 0;
  const lines = [...input.lines]
    .filter((l) => l.quantity > 0)
    .sort((a, b) => a.variantId.localeCompare(b.variantId));

  // Pre-check the ledger keys — a caught P2002 inside a Prisma interactive
  // transaction still aborts the whole transaction, so we never let it fire.
  const keys = lines.map((l) => key([input.keyScope, l.variantId]));
  const already = new Set(
    (
      await tx.inventoryTransaction.findMany({
        where: { idempotencyKey: { in: keys } },
        select: { idempotencyKey: true },
      })
    ).map((r) => r.idempotencyKey),
  );

  for (const line of lines) {
    const k = key([input.keyScope, line.variantId]);
    if (already.has(k)) continue;

    await tx.inventoryTransaction.create({
      data: {
        variantId: line.variantId,
        orderId: line.orderId ?? null,
        type: input.txnType,
        onHandDelta: line.quantity,
        reservedDelta: 0,
        reason: input.reason,
        idempotencyKey: k,
      },
    });
    await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant"
         SET "onHandQty" = "onHandQty" + $2::int, "updatedAt" = now()
       WHERE "id" = $1::uuid`,
      line.variantId,
      line.quantity,
    );
    restockedVariants += 1;
  }
  return { restockedVariants };
}

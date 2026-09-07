import "server-only";

import type { Prisma } from "@/generated/prisma";

import { InsufficientStockError, ReservationNotActiveError } from "./errors";

/**
 * Inventory reservation lifecycle (master spec §7).
 *
 * `available = onHandQty - reservedQty`. Cart additions never reserve. These
 * functions take a `Prisma.TransactionClient` — the CALLER owns the transaction
 * boundary and keeps provider calls outside it. Every stock movement is recorded
 * in the immutable `InventoryTransaction` ledger with a unique idempotency key,
 * so a retry is a no-op.
 */

export type Tx = Prisma.TransactionClient;

export interface ReserveLine {
  variantId: string;
  quantity: number;
}

const key = (parts: (string | number)[]) => parts.join(":");

/** Insert a ledger row; a duplicate idempotency key is treated as "already applied". */
async function ledger(
  tx: Tx,
  data: {
    variantId: string;
    orderId?: string | null;
    type: Prisma.InventoryTransactionCreateInput["type"];
    onHandDelta?: number;
    reservedDelta?: number;
    reason?: string;
    idempotencyKey: string;
  },
): Promise<boolean> {
  try {
    await tx.inventoryTransaction.create({
      data: {
        variantId: data.variantId,
        orderId: data.orderId ?? null,
        type: data.type,
        onHandDelta: data.onHandDelta ?? 0,
        reservedDelta: data.reservedDelta ?? 0,
        reason: data.reason,
        idempotencyKey: data.idempotencyKey,
      },
    });
    return true;
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return false; // already recorded
    }
    throw e;
  }
}

/**
 * Reserve EVERY line atomically, in deterministic variant order (master §7.3).
 * A single failed conditional update rolls the whole caller transaction back.
 * Default prepaid TTL ≈ 10 min (configurable, displayed only after confirmation).
 */
export async function reserveAll(
  tx: Tx,
  input: {
    orderId: string;
    lines: ReserveLine[];
    ttlSeconds: number;
    now?: Date;
  },
): Promise<void> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + input.ttlSeconds * 1000);

  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      throw new InsufficientStockError(line.variantId);
    }
  }
  const lines = [...input.lines]
    .filter((l) => l.quantity > 0)
    .sort((a, b) => a.variantId.localeCompare(b.variantId));

  for (const line of lines) {
    const affected = await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant"
         SET "reservedQty" = "reservedQty" + $2::int, "updatedAt" = now()
       WHERE "id" = $1::uuid
         AND "isActive" = true
         AND ("onHandQty" - "reservedQty") >= $2::int`,
      line.variantId,
      line.quantity,
    );
    if (affected === 0) throw new InsufficientStockError(line.variantId);

    await tx.inventoryReservation.create({
      data: {
        orderId: input.orderId,
        variantId: line.variantId,
        quantity: line.quantity,
        status: "ACTIVE",
        reservationKey: key([input.orderId, line.variantId]),
        expiresAt,
      },
    });
    await ledger(tx, {
      variantId: line.variantId,
      orderId: input.orderId,
      type: "RESERVE",
      reservedDelta: line.quantity,
      idempotencyKey: key(["reserve", input.orderId, line.variantId]),
    });
  }
}

/** Release the order's ACTIVE reservations once (cancel / payment failure). */
export async function releaseReservations(
  tx: Tx,
  input: { orderId: string; reason?: string; now?: Date },
): Promise<number> {
  const now = input.now ?? new Date();
  const rows = await tx.$queryRawUnsafe<
    { id: string; variantId: string; quantity: number }[]
  >(
    `SELECT "id", "variantId", "quantity" FROM "InventoryReservation"
       WHERE "orderId" = $1::uuid AND "status" = 'ACTIVE'
       FOR UPDATE`,
    input.orderId,
  );
  let released = 0;
  for (const r of rows) {
    const upd = await tx.$executeRawUnsafe(
      `UPDATE "InventoryReservation"
         SET "status" = 'RELEASED', "terminalAt" = $2, "updatedAt" = now()
       WHERE "id" = $1::uuid AND "status" = 'ACTIVE'`,
      r.id,
      now,
    );
    if (upd === 0) continue;
    await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant"
         SET "reservedQty" = "reservedQty" - $2::int, "updatedAt" = now()
       WHERE "id" = $1::uuid`,
      r.variantId,
      r.quantity,
    );
    await ledger(tx, {
      variantId: r.variantId,
      orderId: input.orderId,
      type: "RELEASE",
      reservedDelta: -r.quantity,
      reason: input.reason,
      idempotencyKey: key(["release", r.id]),
    });
    released++;
  }
  return released;
}

/**
 * Sweep expired ACTIVE reservations. Uses DB time; `FOR UPDATE SKIP LOCKED` so a
 * concurrent conversion on the same row wins the race and this skips it.
 */
export async function expireReservations(
  tx: Tx,
  input: { now?: Date; limit?: number } = {},
): Promise<number> {
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const rows = await tx.$queryRawUnsafe<
    { id: string; variantId: string; quantity: number; orderId: string }[]
  >(
    `SELECT "id", "variantId", "quantity", "orderId" FROM "InventoryReservation"
       WHERE "status" = 'ACTIVE' AND "expiresAt" <= $1
       ORDER BY "expiresAt" ASC
       LIMIT ${limit}
       FOR UPDATE SKIP LOCKED`,
    now,
  );
  let expired = 0;
  for (const r of rows) {
    const upd = await tx.$executeRawUnsafe(
      `UPDATE "InventoryReservation"
         SET "status" = 'EXPIRED', "terminalAt" = $2, "updatedAt" = now()
       WHERE "id" = $1::uuid AND "status" = 'ACTIVE'`,
      r.id,
      now,
    );
    if (upd === 0) continue;
    await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant"
         SET "reservedQty" = "reservedQty" - $2::int, "updatedAt" = now()
       WHERE "id" = $1::uuid`,
      r.variantId,
      r.quantity,
    );
    await ledger(tx, {
      variantId: r.variantId,
      orderId: r.orderId,
      type: "RELEASE",
      reservedDelta: -r.quantity,
      reason: "expired",
      idempotencyKey: key(["expire", r.id]),
    });
    expired++;
  }
  return expired;
}

/**
 * Convert the order's reservations on verified captured payment (master §7.5):
 * ACTIVE → CONVERTED once, decreasing BOTH on-hand and reserved. If a
 * reservation is no longer ACTIVE (expired/released while payment was in
 * flight), throw — the caller runs the late-capture path (§7.7).
 */
export async function convertReservations(
  tx: Tx,
  input: { orderId: string; now?: Date },
): Promise<number> {
  const now = input.now ?? new Date();
  const rows = await tx.$queryRawUnsafe<
    {
      id: string;
      variantId: string;
      quantity: number;
      status: string;
      reservationKey: string;
    }[]
  >(
    `SELECT "id", "variantId", "quantity", "status", "reservationKey"
       FROM "InventoryReservation"
       WHERE "orderId" = $1::uuid
       FOR UPDATE`,
    input.orderId,
  );
  if (rows.length === 0) return 0;

  for (const r of rows) {
    if (r.status !== "ACTIVE") {
      throw new ReservationNotActiveError(r.reservationKey, r.status);
    }
  }

  let converted = 0;
  for (const r of rows) {
    const upd = await tx.$executeRawUnsafe(
      `UPDATE "InventoryReservation"
         SET "status" = 'CONVERTED', "terminalAt" = $2, "updatedAt" = now()
       WHERE "id" = $1::uuid AND "status" = 'ACTIVE'`,
      r.id,
      now,
    );
    if (upd === 0) throw new ReservationNotActiveError(r.reservationKey, "raced");
    await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant"
         SET "onHandQty" = "onHandQty" - $2::int,
             "reservedQty" = "reservedQty" - $2::int,
             "updatedAt" = now()
       WHERE "id" = $1::uuid`,
      r.variantId,
      r.quantity,
    );
    await ledger(tx, {
      variantId: r.variantId,
      orderId: input.orderId,
      type: "CONVERT",
      onHandDelta: -r.quantity,
      reservedDelta: -r.quantity,
      idempotencyKey: key(["convert", r.id]),
    });
    converted++;
  }
  return converted;
}

/**
 * Try to atomically re-acquire every line's on-hand stock (late capture after
 * expiry, master §7.7). Returns true only if ALL lines could be taken; on any
 * shortfall it rolls back (throws) and the caller marks the order for review.
 */
export async function reacquireForLateCapture(
  tx: Tx,
  input: { orderId: string; lines: ReserveLine[] },
): Promise<void> {
  const lines = [...input.lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
  for (const line of lines) {
    const affected = await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant"
         SET "onHandQty" = "onHandQty" - $2::int, "updatedAt" = now()
       WHERE "id" = $1::uuid AND ("onHandQty" - "reservedQty") >= $2::int`,
      line.variantId,
      line.quantity,
    );
    if (affected === 0) throw new InsufficientStockError(line.variantId);
    await ledger(tx, {
      variantId: line.variantId,
      orderId: input.orderId,
      type: "CONVERT",
      onHandDelta: -line.quantity,
      reason: "late-capture reacquire",
      idempotencyKey: key(["late-capture", input.orderId, line.variantId]),
    });
  }
}

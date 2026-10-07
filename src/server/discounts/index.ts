import "server-only";

import type { AdminUser, DiscountCode, Prisma, PrismaClient } from "@/generated/prisma";
import { auditLog } from "@/server/admin/audit";
import { ValidationError } from "@/server/catalog/admin";

import { normalizeCode } from "./calc";

export * from "./calc";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Discount codes (D-140) — database side: counting live uses, and the admin
 * create/edit operations. Pure validation and allocation live in `calc.ts`.
 */

export async function findCode(db: Db, raw: string): Promise<DiscountCode | null> {
  const code = normalizeCode(raw);
  if (!code) return null;
  return db.discountCode.findUnique({ where: { code } });
}

/**
 * How many uses a code has right now. A use counts unless its order was
 * cancelled (the redemption is released) or it's an unpaid online order whose
 * payment window (`ttlSeconds`, the stock-reservation TTL) has passed, so an
 * abandoned checkout never burns a limited code. Cash-on-delivery and paid
 * orders always count.
 */
export async function countActiveUses(
  db: Db,
  discountCodeId: string,
  opts: { now: Date; ttlSeconds: number },
): Promise<number> {
  const cutoff = new Date(opts.now.getTime() - opts.ttlSeconds * 1000);
  return db.discountRedemption.count({
    where: {
      discountCodeId,
      releasedAt: null,
      order: {
        orderStatus: { not: "CANCELLED" },
        OR: [{ orderStatus: { not: "PENDING_PAYMENT" } }, { placedAt: { gt: cutoff } }],
      },
    },
  });
}

/** Uses per code for the admin list, same rule as `countActiveUses`. */
export async function listCodesWithUses(
  db: PrismaClient,
  opts: { now: Date; ttlSeconds: number },
) {
  const codes = await db.discountCode.findMany({ orderBy: { createdAt: "desc" } });
  const uses = await Promise.all(codes.map((c) => countActiveUses(db, c.id, opts)));
  return codes.map((c, i) => ({ ...c, uses: uses[i] }));
}

export interface DiscountCodeInput {
  code: string;
  kind: "PERCENT" | "FIXED";
  /** PERCENT: whole or decimal percent, e.g. 10 or 12.5 */
  percent?: number | null;
  /** FIXED: rupees */
  amountPaise?: number | null;
  appliesTo: "ALL" | "LABEL" | "CLOSET";
  minSubtotalPaise?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxRedemptions?: number | null;
  isActive: boolean;
  note?: string | null;
}

function toData(input: DiscountCodeInput) {
  const errors: string[] = [];
  const code = normalizeCode(input.code);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    errors.push("Code must be 3–30 letters or numbers (no spaces).");
  }
  let percentBps: number | null = null;
  let amountPaise: number | null = null;
  if (input.kind === "PERCENT") {
    const p = Number(input.percent);
    if (!Number.isFinite(p) || p <= 0 || p > 90) {
      errors.push("Percent off must be more than 0 and at most 90.");
    } else percentBps = Math.round(p * 100);
  } else {
    const a = Number(input.amountPaise);
    if (!Number.isInteger(a) || a <= 0) errors.push("Amount off must be more than ₹0.");
    else amountPaise = a;
  }
  const min = input.minSubtotalPaise ?? null;
  if (min != null && (!Number.isInteger(min) || min < 0)) {
    errors.push("Minimum order must be ₹0 or more.");
  }
  const max = input.maxRedemptions ?? null;
  if (max != null && (!Number.isInteger(max) || max < 1)) {
    errors.push("Usage limit must be 1 or more (leave empty for no limit).");
  }
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
    errors.push("End date must be after the start date.");
  }
  if (errors.length) throw new ValidationError(errors[0], errors);
  return {
    code,
    kind: input.kind,
    percentBps,
    amountPaise,
    appliesTo: input.appliesTo,
    minSubtotalPaise: min,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    maxRedemptions: max,
    isActive: input.isActive,
    note: input.note?.trim() || null,
  };
}

const isP2002 = (e: unknown) => (e as { code?: string })?.code === "P2002";

export async function createDiscountCode(
  db: PrismaClient,
  admin: AdminUser,
  input: DiscountCodeInput,
): Promise<DiscountCode> {
  const data = toData(input);
  try {
    const created = await db.discountCode.create({ data });
    await auditLog(db, {
      adminUserId: admin.id,
      action: "discount.create",
      entityType: "DiscountCode",
      entityId: created.id,
      after: data,
    });
    return created;
  } catch (e) {
    if (isP2002(e)) throw new ValidationError(`The code ${data.code} already exists.`);
    throw e;
  }
}

/** Edits a code. Its text can't change once used, so past orders still match. */
export async function updateDiscountCode(
  db: PrismaClient,
  admin: AdminUser,
  id: string,
  input: DiscountCodeInput,
): Promise<DiscountCode> {
  const before = await db.discountCode.findUniqueOrThrow({ where: { id } });
  const data = toData(input);
  if (data.code !== before.code) {
    const used = await db.discountRedemption.count({ where: { discountCodeId: id } });
    if (used > 0) {
      throw new ValidationError(
        "This code has been used, so its text can't change. Create a new code instead.",
      );
    }
  }
  try {
    const after = await db.discountCode.update({ where: { id }, data });
    await auditLog(db, {
      adminUserId: admin.id,
      action: "discount.update",
      entityType: "DiscountCode",
      entityId: id,
      before,
      after: data,
    });
    return after;
  } catch (e) {
    if (isP2002(e)) throw new ValidationError(`The code ${data.code} already exists.`);
    throw e;
  }
}

/** Deletes a never-used code. A used code can only be switched off. */
export async function deleteDiscountCode(
  db: PrismaClient,
  admin: AdminUser,
  id: string,
): Promise<void> {
  const used = await db.discountRedemption.count({ where: { discountCodeId: id } });
  if (used > 0) {
    throw new ValidationError(
      "This code is on past orders, so it can't be deleted. Switch it off instead.",
    );
  }
  const before = await db.discountCode.delete({ where: { id } });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "discount.delete",
    entityType: "DiscountCode",
    entityId: id,
    before,
  });
}

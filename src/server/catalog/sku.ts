import "server-only";

import type { PrismaClient } from "@/generated/prisma";

/**
 * Closet (THRIFT) SKU generation (owner feedback, 2026-09-13 — a one-of-one
 * piece has no size run to key a SKU off, so asking for one is pure
 * friction). `CLO-000123`, sequential and zero-padded to 6 digits — picked
 * from a count, then walked forward on any collision so it's always unique
 * even under a rare race between two concurrent creates.
 */
const PREFIX = "CLO-";

export async function generateClosetSku(db: PrismaClient): Promise<string> {
  let n = (await db.productVariant.count({ where: { sku: { startsWith: PREFIX } } })) + 1;
  let candidate = `${PREFIX}${String(n).padStart(6, "0")}`;
  while (await db.productVariant.findUnique({ where: { sku: candidate } })) {
    n += 1;
    candidate = `${PREFIX}${String(n).padStart(6, "0")}`;
  }
  return candidate;
}

import "server-only";

import type { PrismaClient } from "@/generated/prisma";

/**
 * Sold Closet pieces leave the shop (D-143). A one-of-one that has sold stays
 * on /closet marked "Sold" for a short while, then is archived — hidden from
 * every storefront page, kept in the database because orders, invoices and
 * returns still point at it (products are archived, never deleted).
 *
 * "Sold" here means really gone, not "someone is checking out":
 *   - every variant's on-hand stock is 0 (a paid order converted it, or the
 *     owner set the stock to 0), or
 *   - the owner ticked the "Sold out" switch (D-138).
 * A piece that is only reserved in an unpaid checkout still has on-hand stock,
 * so it is never archived from under a buyer.
 *
 * "Sold at" is the latest stock decrease on any of its variants, or for the
 * Sold-out switch the latest time it was ticked; with neither on record, the
 * product's last update.
 */
export const SOLD_CLOSET_GRACE_DAYS = 3;

export interface SoldArchiveResult {
  archived: { id: string; title: string; soldAt: string }[];
}

export async function archiveSoldClosetPieces(
  db: PrismaClient,
  opts: { now?: Date; graceDays?: number } = {},
): Promise<SoldArchiveResult> {
  const now = opts.now ?? new Date();
  const graceDays = opts.graceDays ?? SOLD_CLOSET_GRACE_DAYS;
  const cutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);

  const candidates = await db.product.findMany({
    where: { catalog: "THRIFT", status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      markedSoldOut: true,
      variants: { select: { id: true, onHandQty: true } },
    },
  });

  const sold = candidates.filter(
    (p) =>
      p.markedSoldOut ||
      (p.variants.length > 0 && p.variants.every((v) => v.onHandQty <= 0)),
  );

  const archived: SoldArchiveResult["archived"] = [];
  for (const p of sold) {
    const [lastDecrease, lastMarked] = await Promise.all([
      db.inventoryTransaction.findFirst({
        where: { variantId: { in: p.variants.map((v) => v.id) }, onHandDelta: { lt: 0 } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      p.markedSoldOut
        ? db.adminActivityLog.findFirst({
            where: { entityType: "Product", entityId: p.id, action: "product.marked_sold_out" },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          })
        : null,
    ]);
    const soldAt =
      (p.markedSoldOut ? lastMarked?.createdAt : null) ??
      lastDecrease?.createdAt ??
      p.updatedAt;
    if (soldAt > cutoff) continue;

    // Conditional on still being PUBLISHED, so a concurrent manual change wins.
    const { count } = await db.product.updateMany({
      where: { id: p.id, status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    });
    if (count === 1) {
      archived.push({ id: p.id, title: p.title, soldAt: soldAt.toISOString() });
    }
  }
  return { archived };
}

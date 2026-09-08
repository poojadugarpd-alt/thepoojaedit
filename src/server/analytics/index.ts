import "server-only";

import type { CatalogType, PrismaClient } from "@/generated/prisma";

/**
 * analytics domain service (master §10). Financial summaries derive ONLY from
 * canonical `Order` / `OrderItem` / `PaymentAttempt` / `Refund` / `CodRemittance`
 * rows and deliberately distinguish **placed** orders, **captured** revenue,
 * **refunds** and **COD remittance** — these are different amounts and must not
 * be conflated. Acquisition / margin cost is NEVER read here (cost data is
 * restricted, master §10 "cost data restricted").
 */

export interface DateRange {
  from: Date;
  to: Date;
}

export function defaultRange(now: Date = new Date()): DateRange {
  return { from: new Date(now.getTime() - 30 * 24 * 3600_000), to: now };
}

export interface FinancialSummary {
  range: { from: string; to: string };
  placed: {
    orders: number;
    grossPaise: number;
    byMethod: { PREPAID_RAZORPAY: number; COD: number };
    /** Mixed orders are split by line (`OrderItem.totalPaise`), not by order. */
    byCatalogPaise: Record<CatalogType, number>;
  };
  capturedRevenue: {
    prepaidCapturedPaise: number;
    codCollectedPaise: number;
    totalPaise: number;
  };
  refunds: { completedPaise: number; count: number };
  codRemittance: {
    expectedPaise: number;
    collectedPaise: number;
    remittedPaise: number;
    /** Collected but not yet remitted — money the courier still holds. */
    outstandingPaise: number;
  };
  netRevenuePaise: number;
}

export async function getFinancialSummary(
  db: PrismaClient,
  range: DateRange = defaultRange(),
): Promise<FinancialSummary> {
  const placedWhere = { placedAt: { gte: range.from, lte: range.to } } as const;

  const [placedAgg, placedByMethod, lineByCatalog, prepaidCaptured, codCollected, refundAgg, codRows] =
    await Promise.all([
      db.order.aggregate({ where: placedWhere, _count: true, _sum: { totalPaise: true } }),
      db.order.groupBy({
        by: ["paymentMethod"],
        where: placedWhere,
        _sum: { totalPaise: true },
      }),
      db.orderItem.groupBy({
        by: ["catalog"],
        where: { order: placedWhere },
        _sum: { totalPaise: true },
      }),
      db.paymentAttempt.aggregate({
        where: { status: "CAPTURED", order: placedWhere },
        _sum: { amountPaise: true },
      }),
      db.codRemittance.aggregate({
        where: {
          status: { in: ["COLLECTED", "REMITTED", "RECONCILED"] },
          order: placedWhere,
        },
        _sum: { collectedPaise: true },
      }),
      db.refund.aggregate({
        where: { status: "COMPLETED", order: placedWhere },
        _count: true,
        _sum: { amountPaise: true },
      }),
      db.codRemittance.groupBy({
        by: ["status"],
        where: { order: placedWhere },
        _sum: { expectedPaise: true, collectedPaise: true, remittedPaise: true },
      }),
    ]);

  const byMethod = { PREPAID_RAZORPAY: 0, COD: 0 };
  for (const row of placedByMethod) {
    byMethod[row.paymentMethod] = row._sum.totalPaise ?? 0;
  }

  const byCatalogPaise: Record<CatalogType, number> = { THE_POOJA_EDIT: 0, THRIFT: 0 };
  for (const row of lineByCatalog) {
    byCatalogPaise[row.catalog] = row._sum.totalPaise ?? 0;
  }

  const cod = codRows.reduce(
    (acc, r) => ({
      expectedPaise: acc.expectedPaise + (r._sum.expectedPaise ?? 0),
      collectedPaise: acc.collectedPaise + (r._sum.collectedPaise ?? 0),
      remittedPaise: acc.remittedPaise + (r._sum.remittedPaise ?? 0),
    }),
    { expectedPaise: 0, collectedPaise: 0, remittedPaise: 0 },
  );

  const prepaidCapturedPaise = prepaidCaptured._sum.amountPaise ?? 0;
  const codCollectedPaise = codCollected._sum.collectedPaise ?? 0;
  const refundsPaise = refundAgg._sum.amountPaise ?? 0;

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    placed: {
      orders: placedAgg._count,
      grossPaise: placedAgg._sum.totalPaise ?? 0,
      byMethod,
      byCatalogPaise,
    },
    capturedRevenue: {
      prepaidCapturedPaise,
      codCollectedPaise,
      totalPaise: prepaidCapturedPaise + codCollectedPaise,
    },
    refunds: { completedPaise: refundsPaise, count: refundAgg._count },
    codRemittance: {
      expectedPaise: cod.expectedPaise,
      collectedPaise: cod.collectedPaise,
      remittedPaise: cod.remittedPaise,
      outstandingPaise: cod.collectedPaise - cod.remittedPaise,
    },
    netRevenuePaise: prepaidCapturedPaise + codCollectedPaise - refundsPaise,
  };
}

// ─────────────────────────── low stock + attention ──────────────────────────

export interface LowStockRow {
  variantId: string;
  productId: string;
  productTitle: string;
  catalog: CatalogType;
  sku: string;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  lowStockThreshold: number;
}

export async function getLowStock(
  db: PrismaClient,
  opts: { limit?: number } = {},
): Promise<LowStockRow[]> {
  const rows = await db.$queryRawUnsafe<
    {
      id: string;
      productId: string;
      title: string;
      catalog: CatalogType;
      sku: string;
      onHandQty: number;
      reservedQty: number;
      lowStockThreshold: number;
    }[]
  >(
    `SELECT v."id", v."productId", p."title", p."catalog", v."sku",
            v."onHandQty", v."reservedQty", v."lowStockThreshold"
       FROM "ProductVariant" v
       JOIN "Product" p ON p."id" = v."productId"
      WHERE v."isActive" = true
        AND v."lowStockThreshold" > 0
        AND (v."onHandQty" - v."reservedQty") <= v."lowStockThreshold"
      ORDER BY (v."onHandQty" - v."reservedQty") ASC
      LIMIT ${Math.min(Math.max(opts.limit ?? 50, 1), 200)}`,
  );
  return rows.map((r) => ({
    variantId: r.id,
    productId: r.productId,
    productTitle: r.title,
    catalog: r.catalog,
    sku: r.sku,
    onHandQty: r.onHandQty,
    reservedQty: r.reservedQty,
    availableQty: r.onHandQty - r.reservedQty,
    lowStockThreshold: r.lowStockThreshold,
  }));
}

export interface AttentionSummary {
  total: number;
  byType: { type: string; count: number }[];
}

export async function getAttentionSummary(db: PrismaClient): Promise<AttentionSummary> {
  const rows = await db.operationalTask.groupBy({
    by: ["type"],
    where: { status: "OPEN" },
    _count: true,
  });
  return {
    total: rows.reduce((s, r) => s + r._count, 0),
    byType: rows
      .map((r) => ({ type: r.type as string, count: r._count }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface Overview {
  financial: FinancialSummary;
  attention: AttentionSummary;
  lowStock: LowStockRow[];
  openOrders: {
    pendingPayment: number;
    pendingCodConfirmation: number;
    needsReview: number;
    toFulfil: number;
  };
}

export async function getOverview(
  db: PrismaClient,
  range: DateRange = defaultRange(),
): Promise<Overview> {
  const [financial, attention, lowStock, statuses, fulfil] = await Promise.all([
    getFinancialSummary(db, range),
    getAttentionSummary(db),
    getLowStock(db, { limit: 20 }),
    db.order.groupBy({ by: ["orderStatus"], _count: true }),
    db.order.count({
      where: { orderStatus: "CONFIRMED", fulfillmentStatus: "UNFULFILLED" },
    }),
  ]);
  const count = (s: string) =>
    statuses.find((r) => r.orderStatus === s)?._count ?? 0;
  return {
    financial,
    attention,
    lowStock,
    openOrders: {
      pendingPayment: count("PENDING_PAYMENT"),
      pendingCodConfirmation: count("PENDING_CONFIRMATION"),
      needsReview: count("NEEDS_REVIEW"),
      toFulfil: fulfil,
    },
  };
}

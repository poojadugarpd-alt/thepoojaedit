import Link from "next/link";

import { prisma } from "@/lib/db";
import { money } from "@/features/admin/format";
import { getOverview } from "@/server/analytics";

export const dynamic = "force-dynamic";

const TYPE_HREF: Record<string, string> = {
  COD_CONFIRMATION: "/admin/orders?orderStatus=PENDING_CONFIRMATION",
  PAYMENT_REVIEW: "/admin/orders?orderStatus=NEEDS_REVIEW",
  LOW_STOCK: "/admin/inventory",
  RTO_INSPECTION: "/admin/returns",
};

export default async function AdminOverview() {
  const o = await getOverview(prisma);
  const f = o.financial;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Overview</h1>

      {/* Needs Attention */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Needs Attention
          </h2>
          <Link href="/admin/needs-attention" className="text-xs underline">
            {o.attention.total} open
          </Link>
        </div>
        {o.attention.total === 0 ? (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">All clear.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {o.attention.byType.map((t) => (
              <li key={t.type}>
                <Link
                  href={TYPE_HREF[t.type] ?? "/admin/needs-attention"}
                  className="inline-block rounded bg-amber-500/10 px-2 py-1 text-amber-800 dark:text-amber-200"
                >
                  {t.type.replaceAll("_", " ")}: <strong>{t.count}</strong>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Open work */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Pending payment", o.openOrders.pendingPayment, "/admin/orders?orderStatus=PENDING_PAYMENT"],
          ["Pending COD", o.openOrders.pendingCodConfirmation, "/admin/orders?orderStatus=PENDING_CONFIRMATION"],
          ["Needs review", o.openOrders.needsReview, "/admin/orders?orderStatus=NEEDS_REVIEW"],
          ["To fulfil", o.openOrders.toFulfil, "/admin/orders?fulfillmentStatus=UNFULFILLED&orderStatus=CONFIRMED"],
        ].map(([label, n, href]) => (
          <Link
            key={label as string}
            href={href as string}
            className="rounded border border-black/10 p-3 dark:border-white/15"
          >
            <p className="text-2xl font-semibold">{n as number}</p>
            <p className="text-xs text-black/55 dark:text-white/55">{label}</p>
          </Link>
        ))}
      </section>

      {/* Financials — placed vs captured vs refunds vs COD remittance */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Last 30 days
          </h2>
          <Link href="/admin/analytics" className="text-xs underline">
            full analytics
          </Link>
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Stat label="Placed orders" main={String(f.placed.orders)} sub={money(f.placed.grossPaise)} />
          <Stat
            label="Captured revenue"
            main={money(f.capturedRevenue.totalPaise)}
            sub={`prepaid ${money(f.capturedRevenue.prepaidCapturedPaise)} · COD ${money(f.capturedRevenue.codCollectedPaise)}`}
          />
          <Stat
            label="Refunds"
            main={money(f.refunds.completedPaise)}
            sub={`${f.refunds.count} completed`}
          />
          <Stat
            label="COD remittance"
            main={money(f.codRemittance.remittedPaise)}
            sub={`${money(f.codRemittance.outstandingPaise)} with courier`}
          />
        </div>
        <p className="mt-2 text-xs text-black/45 dark:text-white/45">
          Revenue by catalogue (line-allocated): The Pooja Edit{" "}
          {money(f.placed.byCatalogPaise.THE_POOJA_EDIT)} · Thrift{" "}
          {money(f.placed.byCatalogPaise.THRIFT)}. Net (captured − refunds){" "}
          {money(f.netRevenuePaise)}.
        </p>
      </section>

      {/* Low stock */}
      {o.lowStock.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Low stock
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {o.lowStock.slice(0, 8).map((v) => (
              <li key={v.variantId}>
                <Link href="/admin/inventory" className="hover:underline">
                  {v.productTitle} · {v.sku}
                </Link>{" "}
                — available {v.availableQty} (≤ {v.lowStockThreshold})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, main, sub }: { label: string; main: string; sub: string }) {
  return (
    <div className="rounded border border-black/10 p-3 dark:border-white/15">
      <p className="text-xs text-black/55 dark:text-white/55">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{main}</p>
      <p className="text-[11px] text-black/45 dark:text-white/45">{sub}</p>
    </div>
  );
}

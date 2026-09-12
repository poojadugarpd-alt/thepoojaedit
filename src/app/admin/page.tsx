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
      <h1 className="text-xl font-semibold text-ink-strong">Overview</h1>

      {/* Needs Attention — first thing on Home, per the admin-PWA brief. */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Needs Attention
          </h2>
          <Link
            href="/admin/needs-attention"
            className="flex min-h-11 items-center text-xs underline"
          >
            {o.attention.total} open
          </Link>
        </div>
        {o.attention.total === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">All clear.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {o.attention.byType.map((t) => (
              <li key={t.type}>
                <Link
                  href={TYPE_HREF[t.type] ?? "/admin/needs-attention"}
                  className="flex min-h-11 items-center gap-1 rounded bg-wait-bg px-2.5 py-1.5 text-wait"
                >
                  <span aria-hidden="true">●</span>
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
          [
            "Pending payment",
            o.openOrders.pendingPayment,
            "/admin/orders?orderStatus=PENDING_PAYMENT",
          ],
          [
            "Pending COD",
            o.openOrders.pendingCodConfirmation,
            "/admin/orders?orderStatus=PENDING_CONFIRMATION",
          ],
          ["Needs review", o.openOrders.needsReview, "/admin/orders?orderStatus=NEEDS_REVIEW"],
          [
            "To fulfil",
            o.openOrders.toFulfil,
            "/admin/orders?fulfillmentStatus=UNFULFILLED&orderStatus=CONFIRMED",
          ],
        ].map(([label, n, href]) => (
          <Link
            key={label as string}
            href={href as string}
            className="min-h-16 rounded border border-line p-3"
          >
            <p className="text-2xl font-semibold text-ink-strong">{n as number}</p>
            <p className="text-xs text-ink-soft">{label}</p>
          </Link>
        ))}
      </section>

      {/* Financials — placed vs captured vs refunds vs COD remittance */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Last 30 days
          </h2>
          <Link
            href="/admin/analytics"
            className="flex min-h-11 items-center text-xs underline"
          >
            full analytics
          </Link>
        </div>
        <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Placed orders"
            main={String(f.placed.orders)}
            sub={money(f.placed.grossPaise)}
          />
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
        <p className="mt-2 text-xs text-ink-soft/80">
          Revenue by catalogue (line-allocated): The Label{" "}
          {money(f.placed.byCatalogPaise.THE_POOJA_EDIT)} · The Closet{" "}
          {money(f.placed.byCatalogPaise.THRIFT)}. Net (captured − refunds){" "}
          {money(f.netRevenuePaise)}.
        </p>
      </section>

      {/* Low stock */}
      {o.lowStock.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Low stock
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {o.lowStock.slice(0, 8).map((v) => (
              <li key={v.variantId}>
                <Link
                  href="/admin/inventory"
                  className="flex min-h-11 items-center hover:underline"
                >
                  {v.productTitle} · {v.sku} — available {v.availableQty} (≤{" "}
                  {v.lowStockThreshold})
                </Link>
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
    <div className="rounded border border-line p-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-ink-strong">{main}</p>
      <p className="text-[11px] text-ink-soft/80">{sub}</p>
    </div>
  );
}

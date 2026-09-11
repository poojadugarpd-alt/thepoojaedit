import { prisma } from "@/lib/db";
import { money } from "@/features/admin/format";
import { getFinancialSummary, getLowStock } from "@/server/analytics";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const [f, low] = await Promise.all([
    getFinancialSummary(prisma),
    getLowStock(prisma, { limit: 30 }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics — last 30 days</h1>
      <p className="text-xs text-black/50 dark:text-white/50">
        Placed, captured, refunds and COD remittance are distinct amounts and are
        never conflated. Catalogue revenue is line-allocated so a mixed order counts
        toward both. Acquisition / margin cost is never shown here.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        <Card title="Placed orders">
          <Big>{f.placed.orders}</Big>
          <p>{money(f.placed.grossPaise)} gross</p>
          <p className="text-xs text-black/50">
            prepaid {money(f.placed.byMethod.PREPAID_RAZORPAY)} · COD{" "}
            {money(f.placed.byMethod.COD)}
          </p>
        </Card>

        <Card title="Captured revenue">
          <Big>{money(f.capturedRevenue.totalPaise)}</Big>
          <p className="text-xs text-black/50">
            prepaid captured {money(f.capturedRevenue.prepaidCapturedPaise)} · COD
            collected {money(f.capturedRevenue.codCollectedPaise)}
          </p>
        </Card>

        <Card title="Refunds">
          <Big>{money(f.refunds.completedPaise)}</Big>
          <p className="text-xs text-black/50">{f.refunds.count} completed</p>
        </Card>

        <Card title="COD remittance">
          <p>expected {money(f.codRemittance.expectedPaise)}</p>
          <p>collected {money(f.codRemittance.collectedPaise)}</p>
          <p>remitted {money(f.codRemittance.remittedPaise)}</p>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {money(f.codRemittance.outstandingPaise)} still with the courier
          </p>
        </Card>

        <Card title="Revenue by catalogue (line-allocated)">
          <p>The Label {money(f.placed.byCatalogPaise.THE_POOJA_EDIT)}</p>
          <p>The Closet {money(f.placed.byCatalogPaise.THRIFT)}</p>
        </Card>

        <Card title="Net revenue">
          <Big>{money(f.netRevenuePaise)}</Big>
          <p className="text-xs text-black/50">captured − completed refunds</p>
        </Card>
      </div>

      <section>
        <h2 className="text-sm font-semibold">Low stock ({low.length})</h2>
        <ul className="mt-1 text-xs">
          {low.map((v) => (
            <li key={v.variantId}>
              {v.productTitle} · {v.sku} — available {v.availableQty} (≤{" "}
              {v.lowStockThreshold})
            </li>
          ))}
          {low.length === 0 && <li className="text-black/45">none</li>}
        </ul>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-black/10 p-3 dark:border-white/15">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {title}
      </p>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}
function Big({ children }: { children: React.ReactNode }) {
  return <p className="text-2xl font-semibold">{children}</p>;
}

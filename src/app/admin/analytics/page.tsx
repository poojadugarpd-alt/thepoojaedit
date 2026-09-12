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
      <h1 className="text-xl font-semibold text-ink-strong">Analytics — last 30 days</h1>
      <p className="text-xs text-ink-soft">
        Placed, captured, refunds and COD remittance are distinct amounts and are
        never conflated. Catalogue revenue is line-allocated so a mixed order counts
        toward both. Acquisition / margin cost is never shown here.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        <Card title="Placed orders">
          <Big>{f.placed.orders}</Big>
          <p>{money(f.placed.grossPaise)} gross</p>
          <p className="text-xs text-ink-soft">
            prepaid {money(f.placed.byMethod.PREPAID_RAZORPAY)} · COD{" "}
            {money(f.placed.byMethod.COD)}
          </p>
        </Card>

        <Card title="Captured revenue">
          <Big>{money(f.capturedRevenue.totalPaise)}</Big>
          <p className="text-xs text-ink-soft">
            prepaid captured {money(f.capturedRevenue.prepaidCapturedPaise)} · COD
            collected {money(f.capturedRevenue.codCollectedPaise)}
          </p>
        </Card>

        <Card title="Refunds">
          <Big>{money(f.refunds.completedPaise)}</Big>
          <p className="text-xs text-ink-soft">{f.refunds.count} completed</p>
        </Card>

        <Card title="COD remittance">
          <p>expected {money(f.codRemittance.expectedPaise)}</p>
          <p>collected {money(f.codRemittance.collectedPaise)}</p>
          <p>remitted {money(f.codRemittance.remittedPaise)}</p>
          <p className="text-xs text-wait">
            {money(f.codRemittance.outstandingPaise)} still with the courier
          </p>
        </Card>

        <Card title="Revenue by catalogue (line-allocated)">
          <p>The Label {money(f.placed.byCatalogPaise.THE_POOJA_EDIT)}</p>
          <p>The Closet {money(f.placed.byCatalogPaise.THRIFT)}</p>
        </Card>

        <Card title="Net revenue">
          <Big>{money(f.netRevenuePaise)}</Big>
          <p className="text-xs text-ink-soft">captured − completed refunds</p>
        </Card>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink-strong">Low stock ({low.length})</h2>
        <ul className="mt-1 text-xs text-ink">
          {low.map((v) => (
            <li key={v.variantId}>
              {v.productTitle} · {v.sku} — available {v.availableQty} (≤{" "}
              {v.lowStockThreshold})
            </li>
          ))}
          {low.length === 0 && <li className="text-ink-soft">none</li>}
        </ul>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-line p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {title}
      </p>
      <div className="mt-1 space-y-0.5 text-ink">{children}</div>
    </div>
  );
}
function Big({ children }: { children: React.ReactNode }) {
  return <p className="text-2xl font-semibold text-ink-strong">{children}</p>;
}

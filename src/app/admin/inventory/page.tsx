import Link from "next/link";

import { prisma } from "@/lib/db";
import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { ActionForm } from "@/features/admin/action-form";
import { ts } from "@/features/admin/format";
import { listVariantLedger } from "@/server/inventory/adjust";

import { adjustStockAction } from "./actions";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; variant?: string }>;

export default async function AdminInventoryPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const variants = await prisma.productVariant.findMany({
    where: sp.q
      ? {
          OR: [
            { sku: { contains: sp.q, mode: "insensitive" } },
            { product: { title: { contains: sp.q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    orderBy: [{ product: { title: "asc" } }, { sku: "asc" }],
    take: 60,
    include: { product: { select: { title: true, catalog: true } } },
  });

  const ledger = sp.variant ? await listVariantLedger(prisma, sp.variant, 40) : [];
  const ledgerFor = variants.find((v) => v.id === sp.variant);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink-strong">Inventory</h1>
      <p className="text-xs text-ink-soft">
        Corrections are reasoned and audited; on-hand can never fall below reserved or
        below zero. There is no free-form quantity field.
      </p>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="sku / product"
          className="min-h-11 min-w-0 flex-1 rounded border border-line bg-transparent px-2 py-1 text-base sm:max-w-xs sm:text-sm"
        />
        <button className="min-h-11 rounded bg-foreground px-3 text-sm font-semibold text-background">
          Search
        </button>
      </form>

      {/* Mobile: card list */}
      <ul className="space-y-2 sm:hidden">
        {variants.map((v) => (
          <li key={v.id} className="rounded border border-line p-3">
            <p className="text-sm font-medium text-ink-strong">{v.product.title}</p>
            <p className="text-xs text-ink-soft">
              {CATALOG_LABEL[v.product.catalog]} · {v.sku}
              {v.lowStockThreshold > 0 ? ` · low ≤ ${v.lowStockThreshold}` : ""}
            </p>
            <dl className="mt-2 flex gap-4 text-xs">
              <div>
                <dt className="text-ink-soft">On-hand</dt>
                <dd className="text-sm font-semibold text-ink-strong">{v.onHandQty}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Reserved</dt>
                <dd className="text-sm font-semibold text-ink-strong">{v.reservedQty}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Available</dt>
                <dd className="text-sm font-semibold text-ink-strong">
                  {v.onHandQty - v.reservedQty}
                </dd>
              </div>
            </dl>
            <div className="mt-2 flex items-center justify-between gap-2">
              <ActionForm action={adjustStockAction} submitLabel="Apply" compact>
                <input type="hidden" name="variantId" value={v.id} />
                <div className="flex gap-1">
                  <input
                    name="delta"
                    type="number"
                    inputMode="numeric"
                    placeholder="±"
                    className="min-h-11 w-16 rounded border border-line bg-transparent px-1 py-0.5 text-base sm:text-xs"
                  />
                  <input
                    name="reason"
                    placeholder="reason"
                    className="min-h-11 w-32 rounded border border-line bg-transparent px-1 py-0.5 text-base sm:text-xs"
                  />
                </div>
              </ActionForm>
              <Link
                href={`/admin/inventory?variant=${v.id}`}
                className="flex min-h-11 shrink-0 items-center text-xs text-ink-soft underline"
              >
                History
              </Link>
            </div>
          </li>
        ))}
        {variants.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-soft">No variants match.</li>
        )}
      </ul>

      {/* Desktop: table */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 font-medium">Variant</th>
            <th className="py-2 font-medium">On-hand</th>
            <th className="py-2 font-medium">Reserved</th>
            <th className="py-2 font-medium">Available</th>
            <th className="py-2 font-medium">Correct</th>
            <th className="py-2 font-medium">History</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.id} className="border-b border-line/60 align-top">
              <td className="py-2">
                {v.product.title}
                <span className="block text-[11px] text-ink-soft">
                  {CATALOG_LABEL[v.product.catalog]} · {v.sku}
                  {v.lowStockThreshold > 0 ? ` · low ≤ ${v.lowStockThreshold}` : ""}
                </span>
              </td>
              <td className="py-2">{v.onHandQty}</td>
              <td className="py-2">{v.reservedQty}</td>
              <td className="py-2">{v.onHandQty - v.reservedQty}</td>
              <td className="py-2">
                <ActionForm action={adjustStockAction} submitLabel="Apply" compact>
                  <input type="hidden" name="variantId" value={v.id} />
                  <div className="flex gap-1">
                    <input
                      name="delta"
                      type="number"
                      placeholder="±"
                      className="w-14 rounded border border-line bg-transparent px-1 py-0.5 text-xs"
                    />
                    <input
                      name="reason"
                      placeholder="reason"
                      className="w-40 rounded border border-line bg-transparent px-1 py-0.5 text-xs"
                    />
                  </div>
                </ActionForm>
              </td>
              <td className="py-2">
                <Link href={`/admin/inventory?variant=${v.id}`} className="text-xs underline">
                  view
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sp.variant && (
        <section className="rounded border border-line p-3">
          <h2 className="text-sm font-semibold text-ink-strong">
            Ledger{ledgerFor ? ` — ${ledgerFor.sku}` : ""}
          </h2>
          <ul className="mt-2 space-y-1 text-xs">
            {ledger.map((l) => (
              <li key={l.id} className="border-b border-line/60 py-1">
                {ts(l.createdAt)} · {l.type} · on-hand {l.onHandDelta >= 0 ? "+" : ""}
                {l.onHandDelta} reserved {l.reservedDelta >= 0 ? "+" : ""}
                {l.reservedDelta}
                {l.reason ? ` — ${l.reason}` : ""}
              </li>
            ))}
            {ledger.length === 0 && <li className="text-ink-soft">No adjustments yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}

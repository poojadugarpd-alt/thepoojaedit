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

  const ledger = sp.variant
    ? await listVariantLedger(prisma, sp.variant, 40)
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Inventory</h1>
      <p className="text-xs text-black/50 dark:text-white/50">
        Corrections are reasoned and audited; on-hand can never fall below reserved
        or below zero. There is no free-form quantity field.
      </p>

      <form className="text-xs">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="sku / product"
          className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
        />
        <button className="ml-2 rounded bg-foreground px-3 py-1 font-semibold text-background">
          Search
        </button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/15 text-left dark:border-white/20">
            <th className="py-2 font-medium">Variant</th>
            <th className="py-2 font-medium">On-hand</th>
            <th className="py-2 font-medium">Reserved</th>
            <th className="py-2 font-medium">Available</th>
            <th className="py-2 font-medium">Correct</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.id} className="border-b border-black/10 align-top dark:border-white/10">
              <td className="py-2">
                {v.product.title}
                <span className="block text-[11px] text-black/45">
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
                      className="w-14 rounded border border-black/20 bg-transparent px-1 py-0.5 text-xs dark:border-white/25"
                    />
                    <input
                      name="reason"
                      placeholder="reason"
                      className="w-40 rounded border border-black/20 bg-transparent px-1 py-0.5 text-xs dark:border-white/25"
                    />
                  </div>
                </ActionForm>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sp.variant && (
        <section>
          <h2 className="text-sm font-semibold">Ledger</h2>
          <ul className="mt-1 text-xs">
            {ledger.map((l) => (
              <li key={l.id} className="border-b border-black/10 py-1 dark:border-white/10">
                {ts(l.createdAt)} · {l.type} · on-hand {l.onHandDelta >= 0 ? "+" : ""}
                {l.onHandDelta} reserved {l.reservedDelta >= 0 ? "+" : ""}
                {l.reservedDelta}
                {l.reason ? ` — ${l.reason}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

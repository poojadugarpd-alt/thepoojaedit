import Link from "next/link";

import { formatPaiseINR } from "@/lib/money";
import { prisma } from "@/lib/db";
import type { CatalogType } from "@/lib/catalog-routes";
import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { listAdminProducts, type ProductStatusFilter } from "@/server/catalog/admin";

const STATUSES: ProductStatusFilter[] = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{
    catalog?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const catalog =
    sp.catalog === "THE_POOJA_EDIT" || sp.catalog === "THRIFT"
      ? (sp.catalog as CatalogType)
      : undefined;
  const status = (
    STATUSES.includes(sp.status as ProductStatusFilter) ? sp.status : "ALL"
  ) as ProductStatusFilter;
  const q = sp.q ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const take = 30;

  const { items, total } = await listAdminProducts(prisma, {
    catalog,
    status,
    q,
    skip: (page - 1) * take,
    take,
  });
  const pages = Math.ceil(total / take);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (catalog) p.set("catalog", catalog);
    if (status !== "ALL") p.set("status", status);
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `/admin/products?${s}` : "/admin/products";
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products ({total})</h1>
        <Link
          href="/admin/products/new"
          className="rounded bg-foreground px-3 py-1.5 text-sm font-semibold text-background"
        >
          New product
        </Link>
      </div>

      <form method="get" className="mt-4 flex flex-wrap gap-2 text-sm">
        <select
          name="catalog"
          defaultValue={catalog ?? ""}
          className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
        >
          <option value="">All catalogues</option>
          <option value="THE_POOJA_EDIT">The Pooja Edit</option>
          <option value="THRIFT">Thrift</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="title / slug / brand"
          className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
        />
        <button
          type="submit"
          className="rounded border border-black/25 px-3 py-1 dark:border-white/30"
        >
          Filter
        </button>
      </form>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-black/15 text-left dark:border-white/20">
            <th className="py-2 font-medium">Title</th>
            <th className="py-2 font-medium">Catalogue</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Variants</th>
            <th className="py-2 font-medium">Images</th>
            <th className="py-2 font-medium">From</th>
            <th className="py-2 font-medium">Avail.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-b border-black/10 dark:border-white/10">
              <td className="py-2">
                <Link
                  href={`/admin/products/${p.id}`}
                  className="font-medium hover:underline"
                >
                  {p.title}
                </Link>
                <div className="text-[11px] text-black/45 dark:text-white/45">
                  {p.slug}
                </div>
              </td>
              <td className="py-2">{CATALOG_LABEL[p.catalog]}</td>
              <td className="py-2">
                <span
                  className={
                    p.status === "PUBLISHED"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : p.status === "ARCHIVED"
                        ? "text-black/40 dark:text-white/40"
                        : ""
                  }
                >
                  {p.status}
                </span>
              </td>
              <td className="py-2">{p.variantCount}</td>
              <td className="py-2">{p.imageCount}</td>
              <td className="py-2">
                {p.fromPricePaise != null ? formatPaiseINR(p.fromPricePaise) : "—"}
              </td>
              <td className="py-2">{p.available}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="py-8 text-center text-black/50 dark:text-white/50"
              >
                No products match.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pages > 1 && (
        <div className="mt-4 flex gap-3 text-sm">
          {page > 1 && (
            <Link href={qs({ page: String(page - 1) })} className="underline">
              ← Previous
            </Link>
          )}
          <span className="text-black/50 dark:text-white/50">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={qs({ page: String(page + 1) })} className="underline">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

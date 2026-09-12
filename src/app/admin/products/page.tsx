import Image from "next/image";
import Link from "next/link";

import { formatPaiseINR } from "@/lib/money";
import { prisma } from "@/lib/db";
import type { CatalogType } from "@/lib/catalog-routes";
import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { Pill } from "@/features/admin/format";
import { Sheet } from "@/features/admin/sheet";
import { timed } from "@/lib/perf";
import { listAdminProducts, type ProductStatusFilter } from "@/server/catalog/admin";

const STATUSES: ProductStatusFilter[] = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

// 56px, 4:5 — small enough to be free, big enough to recognize the item at a
// glance. A flat line-colour square stands in when a product has no primary
// image yet, rather than a broken/empty <img>.
function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div
        aria-hidden="true"
        className="h-14 w-[45px] shrink-0 rounded bg-fill"
      />
    );
  }
  return (
    <div className="relative h-14 w-[45px] shrink-0 overflow-hidden rounded bg-fill">
      <Image
        src={url}
        alt={alt}
        fill
        sizes="45px"
        loading="lazy"
        className="object-cover"
      />
    </div>
  );
}

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

  // No exact COUNT — the only past use for it was "Page X of Y"; Previous /
  // Next (shown only when there's really another page) needs just `hasMore`.
  const { items, hasMore } = await timed("admin:products-list", () =>
    listAdminProducts(prisma, { catalog, status, q, skip: (page - 1) * take, take }),
  );

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

  const activeFilterCount = (catalog ? 1 : 0) + (status !== "ALL" ? 1 : 0);

  // A full, independent <form> — rendered inline on desktop and again inside
  // the mobile filter sheet — never nested inside the search form below
  // (nesting forms is invalid HTML and browsers silently mis-handle it).
  const filterFields = (
    <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {q && <input type="hidden" name="q" value={q} />}
      <select
        aria-label="Filter by catalogue"
        name="catalog"
        defaultValue={catalog ?? ""}
        className="min-h-11 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
      >
        <option value="">All catalogues</option>
        <option value="THE_POOJA_EDIT">The Label (new apparel)</option>
        <option value="THRIFT">The Closet (pre-loved)</option>
      </select>
      <select
        aria-label="Filter by status"
        name="status"
        defaultValue={status}
        className="min-h-11 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <div className="flex gap-3">
        <button
          type="submit"
          className="min-h-11 flex-1 rounded bg-foreground px-3 text-sm font-semibold text-background sm:flex-none sm:bg-transparent sm:font-normal sm:text-ink sm:border sm:border-line"
        >
          Filter
        </button>
        {activeFilterCount > 0 && (
          <Link
            href="/admin/products"
            className="flex min-h-11 items-center px-3 text-ink-soft underline"
          >
            Clear
          </Link>
        )}
      </div>
    </form>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink-strong">Products</h1>
        <Link
          href="/admin/products/new"
          className="flex min-h-11 items-center rounded bg-foreground px-3 text-sm font-semibold text-background"
        >
          New
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form method="get" className="flex min-w-0 flex-1 items-center gap-2">
          {catalog && <input type="hidden" name="catalog" value={catalog} />}
          {status !== "ALL" && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="title / slug / brand"
            className="min-h-11 min-w-0 flex-1 rounded border border-line bg-transparent px-2 py-1 text-base sm:max-w-xs sm:text-sm"
          />
          <button className="min-h-11 rounded border border-line px-3 text-sm">Search</button>
        </form>

        {/* Desktop: inline filter form. Mobile: same fields, inside a sheet. */}
        <div className="hidden sm:block">{filterFields}</div>
        <Sheet
          title="Filter products"
          trigger={`Filters${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
        >
          {filterFields}
        </Sheet>
      </div>

      {/* Mobile: card list */}
      <ul className="mt-4 space-y-2 sm:hidden">
        {items.map((p) => (
          <li key={p.id} className="rounded border border-line p-3">
            <Link href={`/admin/products/${p.id}`} className="flex gap-3">
              <Thumb url={p.primaryImage?.publicUrl ?? null} alt={p.primaryImage?.altText ?? ""} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-strong">{p.title}</p>
                    <p className="text-[11px] text-ink-soft">
                      {CATALOG_LABEL[p.catalog]} · {p.slug}
                    </p>
                  </div>
                  <Pill value={p.status} />
                </div>
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                  <div>
                    <dt className="inline">Variants </dt>
                    <dd className="inline font-medium text-ink">{p.variantCount}</dd>
                  </div>
                  <div>
                    <dt className="inline">Images </dt>
                    <dd className="inline font-medium text-ink">{p.imageCount}</dd>
                  </div>
                  <div>
                    <dt className="inline">From </dt>
                    <dd className="inline font-medium text-ink">
                      {p.fromPricePaise != null ? formatPaiseINR(p.fromPricePaise) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Avail. </dt>
                    <dd className="inline font-medium text-ink">{p.available}</dd>
                  </div>
                </dl>
              </div>
            </Link>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-soft">No products match.</li>
        )}
      </ul>

      {/* Desktop: table */}
      <table className="mt-4 hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 font-medium" aria-label="Photo" />
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
            <tr key={p.id} className="border-b border-line/60">
              <td className="py-2 pr-2">
                <Link href={`/admin/products/${p.id}`}>
                  <Thumb
                    url={p.primaryImage?.publicUrl ?? null}
                    alt={p.primaryImage?.altText ?? ""}
                  />
                </Link>
              </td>
              <td className="py-2">
                <Link
                  href={`/admin/products/${p.id}`}
                  className="font-medium hover:underline"
                >
                  {p.title}
                </Link>
                <div className="text-[11px] text-ink-soft">{p.slug}</div>
              </td>
              <td className="py-2">{CATALOG_LABEL[p.catalog]}</td>
              <td className="py-2">
                <Pill value={p.status} />
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
              <td colSpan={8} className="py-8 text-center text-ink-soft">
                No products match.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {(page > 1 || hasMore) && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={qs({ page: String(page - 1) })}
              className="flex min-h-11 items-center underline"
            >
              ← Previous
            </Link>
          )}
          <span className="text-ink-soft">Page {page}</span>
          {hasMore && (
            <Link
              href={qs({ page: String(page + 1) })}
              className="flex min-h-11 items-center underline"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";

import { rupeesToPaise } from "@/lib/money";
import { CATALOG_LABEL, type CatalogType } from "@/lib/catalog-routes";
import {
  SEGMENT_BY_CATALOG,
  getFacets,
  listProducts,
  type ProductSort,
} from "@/server/catalog";

import { CatalogFilters, parseFilterState } from "./catalog-filters";
import { LoadMoreGrid } from "./load-more";

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const INTRO: Record<CatalogType, string> = {
  THE_POOJA_EDIT:
    "Pooja&rsquo;s own designs — kurtis, co-ord sets and linen, made in real sizes and small runs.",
  THRIFT:
    "Pooja&rsquo;s own wardrobe, passed on. Each piece is listed as-is with its own measurements; when it&rsquo;s gone, it&rsquo;s gone.",
};

export interface CatalogSearchParams {
  sort?: string;
  size?: string | string[];
  priceMin?: string;
  priceMax?: string;
  inStockOnly?: string;
}

const SORTS = new Set<ProductSort>(["newest", "price_asc", "price_desc"]);

export async function CatalogListing({
  catalog,
  searchParams,
}: {
  catalog: CatalogType;
  searchParams: CatalogSearchParams;
}) {
  const segment = SEGMENT_BY_CATALOG[catalog];
  const sort = SORTS.has(searchParams.sort as ProductSort)
    ? (searchParams.sort as ProductSort)
    : "newest";
  const filterState = parseFilterState(searchParams);

  const [page, facets] = await Promise.all([
    listProducts({
      catalog,
      sort,
      filters: {
        sizes: filterState.sizes.length ? filterState.sizes : undefined,
        priceMinPaise: filterState.priceMin
          ? rupeesToPaise(filterState.priceMin)
          : undefined,
        priceMaxPaise: filterState.priceMax
          ? rupeesToPaise(filterState.priceMax)
          : undefined,
        inStockOnly: filterState.inStockOnly,
      },
    }),
    getFacets(catalog),
  ]);

  // Preserves every active filter param when switching sort — a shopper who
  // filtered to size M shouldn't have that reset just by re-sorting.
  const sortHref = (value: ProductSort) => {
    const qs = new URLSearchParams();
    if (value !== "newest") qs.set("sort", value);
    for (const s of filterState.sizes) qs.append("size", s);
    if (filterState.priceMin) qs.set("priceMin", filterState.priceMin);
    if (filterState.priceMax) qs.set("priceMax", filterState.priceMax);
    if (filterState.inStockOnly) qs.set("inStockOnly", "1");
    const s = qs.toString();
    return s ? `/${segment}?${s}` : `/${segment}`;
  };

  return (
    <div className="u-page py-14 sm:py-20">
      <header className="max-w-3xl">
        <h1 className="u-display">{CATALOG_LABEL[catalog]}</h1>
        <p
          className="u-lead mt-5"
          dangerouslySetInnerHTML={{ __html: INTRO[catalog] }}
        />
      </header>

      <nav
        aria-label="Sort"
        className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2"
      >
        {SORT_OPTIONS.map((opt) => {
          const active = opt.value === sort;
          return (
            <Link
              key={opt.value}
              href={sortHref(opt.value)}
              aria-current={active ? "true" : undefined}
              className={`text-[0.8125rem] font-bold uppercase tracking-[0.06em] transition-opacity ${
                active
                  ? "text-ink-strong underline underline-offset-4"
                  : "text-ink hover:opacity-60"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </nav>

      <CatalogFilters facets={facets} state={filterState} sort={sort} />

      <div className="mt-12">
        {page.items.length === 0 ? (
          <p className="u-eyebrow">Nothing matches these filters right now.</p>
        ) : (
          <LoadMoreGrid
            segment={segment}
            sort={sort}
            filters={filterState}
            initialItems={page.items}
            initialCursor={page.nextCursor}
          />
        )}
      </div>
    </div>
  );
}

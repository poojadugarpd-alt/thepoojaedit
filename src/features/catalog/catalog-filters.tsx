import type { ProductFacets } from "@/server/catalog";

/** The filter state a listing page reads from `searchParams` — shared by the
 * page-level parsing, the filter form below, and `LoadMoreGrid` so "load
 * more" carries the same filters as the page it's appending to. */
export interface CatalogFilterState {
  sizes: string[];
  priceMin: string; // rupees, as typed — kept as a string so a form re-render
  priceMax: string; // shows exactly what the shopper entered, not a rounded number
  inStockOnly: boolean;
}

export function parseFilterState(sp: {
  size?: string | string[];
  priceMin?: string;
  priceMax?: string;
  inStockOnly?: string;
}): CatalogFilterState {
  return {
    sizes: Array.isArray(sp.size) ? sp.size : sp.size ? [sp.size] : [],
    priceMin: sp.priceMin ?? "",
    priceMax: sp.priceMax ?? "",
    inStockOnly: sp.inStockOnly === "1",
  };
}

/** A plain GET form — no client JS needed to apply filters, matching how
 * sort already works here. Submitting resets pagination (a fresh listing
 * starts from the first page) but keeps the current sort via a hidden field. */
export function CatalogFilters({
  facets,
  state,
  sort,
}: {
  facets: ProductFacets;
  state: CatalogFilterState;
  sort: string;
}) {
  const hasActiveFilters = Boolean(
    state.sizes.length > 0 || state.priceMin || state.priceMax || state.inStockOnly,
  );

  return (
    <details className="mt-8 rounded border border-line" open={hasActiveFilters}>
      <summary className="cursor-pointer select-none px-4 py-3 text-[0.8125rem] font-bold uppercase tracking-[0.06em]">
        Filter{hasActiveFilters ? " (active)" : ""}
      </summary>
      <form method="GET" className="border-t border-line px-4 py-5">
        {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}

        {facets.sizes.length > 0 && (
          <fieldset className="mb-5">
            <legend className="u-label mb-2">Size</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {facets.sizes.map((size) => (
                <label
                  key={size}
                  className="flex min-h-11 items-center gap-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="size"
                    value={size}
                    defaultChecked={state.sizes.includes(size)}
                  />
                  {size}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {(facets.priceMinPaise != null || facets.priceMaxPaise != null) && (
          <fieldset className="mb-5">
            <legend className="u-label mb-2">Price (₹)</legend>
            <div className="flex items-center gap-3">
              <label className="sr-only" htmlFor="f-priceMin">
                Minimum price
              </label>
              <input
                id="f-priceMin"
                type="number"
                name="priceMin"
                min={0}
                step="1"
                placeholder={String(Math.floor((facets.priceMinPaise ?? 0) / 100))}
                defaultValue={state.priceMin}
                className="min-h-11 w-28 rounded border border-line bg-transparent px-2 py-1.5 text-sm"
              />
              <span className="text-ink-soft">to</span>
              <label className="sr-only" htmlFor="f-priceMax">
                Maximum price
              </label>
              <input
                id="f-priceMax"
                type="number"
                name="priceMax"
                min={0}
                step="1"
                placeholder={String(Math.ceil((facets.priceMaxPaise ?? 0) / 100))}
                defaultValue={state.priceMax}
                className="min-h-11 w-28 rounded border border-line bg-transparent px-2 py-1.5 text-sm"
              />
            </div>
          </fieldset>
        )}

        <label className="mb-5 flex min-h-11 items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            name="inStockOnly"
            value="1"
            defaultChecked={state.inStockOnly}
          />
          Hide sold-out / out-of-stock pieces
        </label>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button type="submit" className="u-pill">
            Apply filters
          </button>
          {hasActiveFilters && (
            <a
              href={sort !== "newest" ? `?sort=${sort}` : "?"}
              className="u-textlink text-sm"
            >
              Clear filters
            </a>
          )}
        </div>
      </form>
    </details>
  );
}

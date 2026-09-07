import type { Metadata } from "next";

import { ProductGrid } from "@/features/catalog/product-grid";
import type { CatalogType } from "@/lib/catalog-routes";
import { searchProducts } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

const CATALOGS: { value: CatalogType | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "THE_POOJA_EDIT", label: "The Pooja Edit" },
  { value: "THRIFT", label: "Thrift" },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; in?: string }>;
}) {
  const { q = "", in: inParam } = await searchParams;
  const query = q.trim();
  const catalog = (
    inParam === "THE_POOJA_EDIT" || inParam === "THRIFT" ? inParam : undefined
  ) as CatalogType | undefined;

  const results = query.length >= 2 ? await searchProducts({ q: query, catalog }) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>

      <form method="get" action="/search" className="mt-6 flex flex-wrap gap-3">
        <label htmlFor="q" className="sr-only">
          Search products
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name or brand"
          className="min-w-[16rem] flex-1 rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
        />
        <select
          name="in"
          defaultValue={inParam ?? ""}
          aria-label="Catalogue"
          className="rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
        >
          {CATALOGS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          Search
        </button>
      </form>

      <div className="mt-10">
        {query.length < 2 ? (
          <p className="text-sm text-black/55 dark:text-white/55">
            Type at least two characters to search.
          </p>
        ) : (
          <>
            <p className="mb-6 text-sm text-black/55 dark:text-white/55">
              {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;
              {query}&rdquo;
            </p>
            <ProductGrid
              products={results}
              emptyMessage={`No matches for “${query}”. Try a shorter or different term.`}
            />
          </>
        )}
      </div>
    </div>
  );
}

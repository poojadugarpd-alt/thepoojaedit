import Link from "next/link";

import { CATALOG_LABEL, type CatalogType } from "@/lib/catalog-routes";
import { SEGMENT_BY_CATALOG, listProducts, type ProductSort } from "@/server/catalog";

import { LoadMoreGrid } from "./load-more";

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const INTRO: Record<CatalogType, string> = {
  THE_POOJA_EDIT:
    "Original, slow-made apparel from the studio — kurtis, co-ord sets and linen.",
  THRIFT:
    "Pre-loved and one-of-one. Each piece is listed as-is with its own measurements; when it&rsquo;s gone, it&rsquo;s gone.",
};

export async function CatalogListing({
  catalog,
  sort = "newest",
}: {
  catalog: CatalogType;
  sort?: ProductSort;
}) {
  const segment = SEGMENT_BY_CATALOG[catalog];
  const page = await listProducts({ catalog, sort });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {CATALOG_LABEL[catalog]}
        </h1>
        <p
          className="mt-3 text-sm text-black/65 dark:text-white/65"
          dangerouslySetInnerHTML={{ __html: INTRO[catalog] }}
        />
      </header>

      <nav aria-label="Sort" className="mt-8 flex flex-wrap gap-2 text-sm">
        {SORT_OPTIONS.map((opt) => {
          const active = opt.value === sort;
          return (
            <Link
              key={opt.value}
              href={
                opt.value === "newest" ? `/${segment}` : `/${segment}?sort=${opt.value}`
              }
              aria-current={active ? "true" : undefined}
              className={`rounded-full border px-3 py-1 transition-colors ${
                active
                  ? "border-black bg-foreground text-background dark:border-white"
                  : "border-black/20 hover:border-black/50 dark:border-white/25 dark:hover:border-white/60"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-10">
        <LoadMoreGrid
          segment={segment}
          sort={sort}
          initialItems={page.items}
          initialCursor={page.nextCursor}
        />
      </div>
    </div>
  );
}

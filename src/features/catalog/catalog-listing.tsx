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
    "Pooja&rsquo;s own designs — kurtis, co-ord sets and linen, made in real sizes and small runs.",
  THRIFT:
    "Pooja&rsquo;s own wardrobe, passed on. Each piece is listed as-is with its own measurements; when it&rsquo;s gone, it&rsquo;s gone.",
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
              href={
                opt.value === "newest" ? `/${segment}` : `/${segment}?sort=${opt.value}`
              }
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

      <div className="mt-12">
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

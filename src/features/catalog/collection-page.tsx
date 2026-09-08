import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { CatalogType } from "@/lib/catalog-routes";
import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { SEGMENT_BY_CATALOG, getCollection } from "@/server/catalog";

import { ProductGrid } from "./product-grid";

export async function buildCollectionMetadata(
  catalog: CatalogType,
  slug: string,
): Promise<Metadata> {
  const col = await getCollection(catalog, slug);
  const segment = SEGMENT_BY_CATALOG[catalog];
  if (!col) return { title: "Collection not found", robots: { index: false } };
  const path = `/${segment}/collections/${slug}`;
  return {
    title: `${col.name} · ${CATALOG_LABEL[catalog]}`,
    description: col.description ?? `${col.name} from ${CATALOG_LABEL[catalog]}.`,
    alternates: { canonical: path },
    openGraph: { title: col.name, url: path },
  };
}

export async function CollectionPage({
  catalog,
  slug,
}: {
  catalog: CatalogType;
  slug: string;
}) {
  const col = await getCollection(catalog, slug);
  if (!col) notFound();
  const segment = SEGMENT_BY_CATALOG[catalog];

  return (
    <div className="u-page py-14 sm:py-20">
      <nav aria-label="Breadcrumb" className="mb-8 text-[0.8125rem] text-ink-soft">
        <Link
          href={`/${segment}`}
          className="font-bold uppercase tracking-[0.06em] hover:opacity-70"
        >
          {CATALOG_LABEL[catalog]}
        </Link>
        <span aria-hidden> / </span>
        <span>{col.name}</span>
      </nav>
      <h1 className="u-display">{col.name}</h1>
      {col.description && <p className="u-lead mt-5">{col.description}</p>}
      <div className="mt-12">
        <ProductGrid
          products={col.products}
          emptyMessage="Nothing in this collection right now."
        />
      </div>
    </div>
  );
}

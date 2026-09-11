import type { Metadata } from "next";

import { CatalogListing } from "@/features/catalog/catalog-listing";
import type { ProductSort } from "@/server/catalog";

export const metadata: Metadata = {
  title: "The Label",
  description:
    "The Label is Pooja Dugar's own designs — kurtis, co-ord sets and linen, made in real sizes and small runs.",
  alternates: { canonical: "/label" },
  openGraph: { title: "The Label", url: "/label" },
};

const SORTS = new Set<ProductSort>(["newest", "price_asc", "price_desc"]);

export default async function LabelPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  return (
    <CatalogListing
      catalog="THE_POOJA_EDIT"
      sort={SORTS.has(sort as ProductSort) ? (sort as ProductSort) : "newest"}
    />
  );
}

import type { Metadata } from "next";

import { CatalogListing } from "@/features/catalog/catalog-listing";
import type { ProductSort } from "@/server/catalog";

export const metadata: Metadata = {
  title: "The Pooja Edit",
  description:
    "Original, slow-made apparel from The Pooja Edit — kurtis, co-ord sets and linen.",
  alternates: { canonical: "/the-pooja-edit" },
  openGraph: { title: "The Pooja Edit", url: "/the-pooja-edit" },
};

const SORTS = new Set<ProductSort>(["newest", "price_asc", "price_desc"]);

export default async function ThePoojaEditPage({
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

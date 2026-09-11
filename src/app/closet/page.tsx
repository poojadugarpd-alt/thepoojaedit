import type { Metadata } from "next";

import { CatalogListing } from "@/features/catalog/catalog-listing";
import type { ProductSort } from "@/server/catalog";

export const metadata: Metadata = {
  title: "The Closet",
  description:
    "The Closet is Pooja Dugar's own wardrobe, passed on. Pre-loved, one-of-one pieces — each listed as-is with its own measurements.",
  alternates: { canonical: "/closet" },
  openGraph: { title: "The Closet", url: "/closet" },
};

const SORTS = new Set<ProductSort>(["newest", "price_asc", "price_desc"]);

export default async function ClosetPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  return (
    <CatalogListing
      catalog="THRIFT"
      sort={SORTS.has(sort as ProductSort) ? (sort as ProductSort) : "newest"}
    />
  );
}

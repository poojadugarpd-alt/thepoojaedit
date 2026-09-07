import type { Metadata } from "next";

import { CatalogListing } from "@/features/catalog/catalog-listing";
import type { ProductSort } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Thrift Store",
  description:
    "Pre-loved, one-of-one fashion. Each piece listed as-is with its own measurements.",
  alternates: { canonical: "/thrift" },
  openGraph: { title: "Thrift Store", url: "/thrift" },
};

const SORTS = new Set<ProductSort>(["newest", "price_asc", "price_desc"]);

export default async function ThriftPage({
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

import type { Metadata } from "next";

import {
  CatalogListing,
  type CatalogSearchParams,
} from "@/features/catalog/catalog-listing";

export const metadata: Metadata = {
  title: "The Closet",
  description:
    "The Closet is Pooja Dugar's own wardrobe, passed on. Pre-loved, one-of-one pieces — each listed as-is with its own measurements.",
  alternates: { canonical: "/closet" },
  openGraph: { title: "The Closet", url: "/closet" },
};

export default async function ClosetPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  return <CatalogListing catalog="THRIFT" searchParams={await searchParams} />;
}

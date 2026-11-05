import type { Metadata } from "next";

import {
  CatalogListing,
  type CatalogSearchParams,
} from "@/features/catalog/catalog-listing";

export const metadata: Metadata = {
  title: { absolute: "Curated Thrift Store & Pre-Loved Fashion | Pooja's Closet" },
  description:
    "Shop 1-of-1 pre-loved fashion, vintage tops, dresses, and thrifted apparel from Pooja Dugar's wardrobe. Verified condition with individual garment measurements.",
  alternates: { canonical: "/closet" },
  openGraph: {
    title: "Curated Thrift Store & Pre-Loved Fashion | Pooja's Closet",
    description:
      "Shop 1-of-1 pre-loved fashion, vintage tops, dresses, and thrifted apparel from Pooja Dugar's wardrobe. Verified condition with individual garment measurements.",
    url: "/closet",
  },
};

export default async function ClosetPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  return <CatalogListing catalog="THRIFT" searchParams={await searchParams} />;
}

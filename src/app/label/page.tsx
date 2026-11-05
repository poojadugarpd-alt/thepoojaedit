import type { Metadata } from "next";

import {
  CatalogListing,
  type CatalogSearchParams,
} from "@/features/catalog/catalog-listing";

export const metadata: Metadata = {
  title: { absolute: "Designer Kurtis, Co-ords & Linen | The Pooja Edit" },
  description:
    "Shop designer kurtis, contemporary co-ord sets, and everyday linen designed by Pooja Dugar. Tailored in small runs with real-size fits. Delivered across India.",
  alternates: { canonical: "/label" },
  openGraph: {
    title: "Designer Kurtis, Co-ords & Linen | The Pooja Edit",
    description:
      "Shop designer kurtis, contemporary co-ord sets, and everyday linen designed by Pooja Dugar. Tailored in small runs with real-size fits.",
    url: "/label",
  },
};

export default async function LabelPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  return <CatalogListing catalog="THE_POOJA_EDIT" searchParams={await searchParams} />;
}

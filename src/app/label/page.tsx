import type { Metadata } from "next";

import {
  CatalogListing,
  type CatalogSearchParams,
} from "@/features/catalog/catalog-listing";

export const metadata: Metadata = {
  title: "The Label",
  description:
    "The Label is Pooja Dugar's own designs — kurtis, co-ord sets and linen, made in real sizes and small runs.",
  alternates: { canonical: "/label" },
  openGraph: { title: "The Label", url: "/label" },
};

export default async function LabelPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  return <CatalogListing catalog="THE_POOJA_EDIT" searchParams={await searchParams} />;
}

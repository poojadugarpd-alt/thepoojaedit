import type { Metadata } from "next";

import {
  CatalogProductPage,
  buildProductMetadata,
} from "@/features/catalog/catalog-product-page";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return buildProductMetadata("THE_POOJA_EDIT", slug);
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  return <CatalogProductPage catalog="THE_POOJA_EDIT" slug={slug} />;
}

import type { Metadata } from "next";

import {
  CatalogProductPage,
  buildProductMetadata,
} from "@/features/catalog/catalog-product-page";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return buildProductMetadata("THRIFT", slug);
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  return <CatalogProductPage catalog="THRIFT" slug={slug} />;
}

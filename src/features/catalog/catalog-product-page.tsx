import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { publicEnv } from "@/lib/public-env";
import type { CatalogType } from "@/lib/catalog-routes";
import { SEGMENT_BY_CATALOG, getProduct, listProducts } from "@/server/catalog";

import { ProductDetail } from "./product-detail";

export async function buildProductMetadata(
  catalog: CatalogType,
  slug: string,
): Promise<Metadata> {
  const product = await getProduct(catalog, slug);
  const segment = SEGMENT_BY_CATALOG[catalog];
  if (!product) return { title: "Not found", robots: { index: false } };

  const description =
    product.metaDescription ??
    (product.description
      ? product.description.replace(/\s+/g, " ").slice(0, 160)
      : `${product.title}${product.brand ? ` · ${product.brand}` : ""}`);
  const path = `/${segment}/${product.slug}`;
  const image = product.images[0]?.url;

  return {
    title: product.metaTitle ?? product.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: product.title,
      description,
      url: path,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export async function CatalogProductPage({
  catalog,
  slug,
}: {
  catalog: CatalogType;
  slug: string;
}) {
  const product = await getProduct(catalog, slug);
  if (!product) notFound();

  const alternatives =
    product.availability === "SOLD"
      ? (await listProducts({ catalog, limit: 8 })).items
          .filter((c) => c.slug !== product.slug && c.availability === "IN_STOCK")
          .slice(0, 4)
      : [];

  void publicEnv; // metadataBase already set in the root layout
  return <ProductDetail product={product} alternatives={alternatives} />;
}

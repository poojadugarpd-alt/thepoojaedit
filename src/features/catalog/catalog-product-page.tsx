import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { publicEnv } from "@/lib/public-env";
import type { CatalogType } from "@/lib/catalog-routes";
import { closetSeoTitle } from "@/lib/seo-title";
import {
  SEGMENT_BY_CATALOG,
  getProduct,
  isRetiredClosetPiece,
  isSoldClosetPiece,
  listProducts,
} from "@/server/catalog";

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

  // The owner's own SEO title wins; Closet pieces otherwise get size + Pre-loved.
  const title =
    product.metaTitle ??
    (product.isThrift
      ? closetSeoTitle(
          product.title,
          product.sizes[0] ?? product.thrift?.labelledSize ?? null,
        )
      : product.title);

  return {
    title,
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
  const closet = `/${SEGMENT_BY_CATALOG.THRIFT}`;
  if (!product) {
    // An archived Closet piece's old link lands in the shop, not on a 404.
    if (catalog === "THRIFT" && (await isRetiredClosetPiece(slug))) {
      permanentRedirect(closet);
    }
    notFound();
  }
  // Sold Closet pieces are hidden straight away (owner, 2026-10-20). Not
  // permanent: a returned piece can be put back on sale.
  if (isSoldClosetPiece(product)) redirect(closet);

  const alternatives =
    product.availability === "SOLD"
      ? (await listProducts({ catalog, limit: 8 })).items
          .filter((c) => c.slug !== product.slug && c.availability === "IN_STOCK")
          .slice(0, 4)
      : [];

  void publicEnv; // metadataBase already set in the root layout
  return <ProductDetail product={product} alternatives={alternatives} />;
}

import "server-only";

/**
 * Catalog domain service. Business logic lives in `./queries` (public reads) and
 * `./product-images` (Phase 3); this module binds the shared Prisma client.
 * Admin write operations are added later in Phase 4.
 */
import type { CatalogType } from "@/generated/prisma";
import { prisma } from "@/lib/db";

import {
  getActiveCollection,
  getPublishedProduct,
  listActiveCollections,
  listPublishedProducts,
  searchPublishedProducts,
  type ProductPage,
  type ProductSort,
} from "./queries";

export * from "./public-shape";
export { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "./queries";
export type { ProductPage, ProductSort } from "./queries";
export {
  CATALOG_BY_SEGMENT,
  SEGMENT_BY_CATALOG,
  CATALOG_LABEL,
  catalogFromSegment,
  productPath,
} from "@/lib/catalog-routes";

export function listProducts(opts: {
  catalog: CatalogType;
  limit?: number;
  cursor?: string | null;
  sort?: ProductSort;
  categorySlug?: string;
}): Promise<ProductPage> {
  return listPublishedProducts(prisma, opts);
}

export function getProduct(catalog: CatalogType, slug: string) {
  return getPublishedProduct(prisma, catalog, slug);
}

export function searchProducts(opts: {
  q: string;
  catalog?: CatalogType;
  limit?: number;
}) {
  return searchPublishedProducts(prisma, opts);
}

export function getCollections(catalog: CatalogType) {
  return listActiveCollections(prisma, catalog);
}

export function getCollection(catalog: CatalogType, slug: string) {
  return getActiveCollection(prisma, catalog, slug);
}

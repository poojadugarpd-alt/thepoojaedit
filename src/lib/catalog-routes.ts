/**
 * Catalog <-> URL-segment mapping. Client-safe (no server-only, no DB) so both
 * storefront server components and client components can use it.
 *
 * The `CatalogType` values and URL segments are deliberately decoupled: the
 * enum (`THE_POOJA_EDIT` / `THRIFT`) is the Prisma schema's on-disk identity
 * and Storage object-path prefix (see `product-images.ts`'s own, separate
 * `CATALOG_PREFIX`) and never changes; the segment/label below is the
 * storefront's current *presentation* of that catalog and can be renamed
 * (D-93) without touching the database.
 */
export type CatalogType = "THE_POOJA_EDIT" | "THRIFT";

export const CATALOG_BY_SEGMENT = {
  label: "THE_POOJA_EDIT",
  closet: "THRIFT",
} as const satisfies Record<string, CatalogType>;

export const SEGMENT_BY_CATALOG = {
  THE_POOJA_EDIT: "label",
  THRIFT: "closet",
} as const satisfies Record<CatalogType, string>;

export const CATALOG_LABEL: Record<CatalogType, string> = {
  THE_POOJA_EDIT: "The Label",
  THRIFT: "The Closet",
};

/** Short form for space-constrained nav (header at 360px). */
export const CATALOG_LABEL_SHORT: Record<CatalogType, string> = {
  THE_POOJA_EDIT: "Label",
  THRIFT: "Closet",
};

export function catalogFromSegment(segment: string): CatalogType | null {
  return (CATALOG_BY_SEGMENT as Record<string, CatalogType>)[segment] ?? null;
}

export function productPath(catalog: CatalogType, slug: string): string {
  return `/${SEGMENT_BY_CATALOG[catalog]}/${slug}`;
}

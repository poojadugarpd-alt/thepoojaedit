/**
 * Catalog <-> URL-segment mapping. Client-safe (no server-only, no DB) so both
 * storefront server components and client components can use it.
 */
export type CatalogType = "THE_POOJA_EDIT" | "THRIFT";

export const CATALOG_BY_SEGMENT = {
  "the-pooja-edit": "THE_POOJA_EDIT",
  thrift: "THRIFT",
} as const satisfies Record<string, CatalogType>;

export const SEGMENT_BY_CATALOG = {
  THE_POOJA_EDIT: "the-pooja-edit",
  THRIFT: "thrift",
} as const satisfies Record<CatalogType, string>;

export const CATALOG_LABEL: Record<CatalogType, string> = {
  THE_POOJA_EDIT: "The Pooja Edit",
  THRIFT: "Thrift Store",
};

export function catalogFromSegment(segment: string): CatalogType | null {
  return (CATALOG_BY_SEGMENT as Record<string, CatalogType>)[segment] ?? null;
}

export function productPath(catalog: CatalogType, slug: string): string {
  return `/${SEGMENT_BY_CATALOG[catalog]}/${slug}`;
}

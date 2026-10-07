import "server-only";

import type {
  CatalogType,
  ProductImage,
  ProductVariant,
  ThriftDetails,
} from "@/generated/prisma";
import { productImageUrl } from "@/lib/storage-url";

/**
 * Shapes the DB rows into the payload the public storefront is allowed to see.
 *
 * Rules (master spec §4, §5):
 *  - Acquisition cost / date NEVER leave the server.
 *  - Reserved quantity and low-stock thresholds are internal — the client sees
 *    only an advisory `available` boolean and prices.
 *  - Availability is DERIVED from stock, not from publication status. A sold
 *    one-of-one thrift piece stays readable with `availability: "SOLD"`.
 */

/** ON_HOLD: every unit left is held by someone else's unpaid checkout, which
 *  either completes or frees it within the hold (D-150). */
export type PublicAvailability = "IN_STOCK" | "ON_HOLD" | "OUT_OF_STOCK" | "SOLD";

/**
 * Soft per-order ceiling for the quantity picker — a UX convenience, not a
 * stock boundary; checkout re-validates true availability regardless. Capped
 * from above at real stock so the picker never offers a quantity the store
 * can't fulfil (the bug this was added to fix: the old flat `9` let a
 * customer select one more than an 8-in-stock variant actually had).
 */
export const MAX_ORDER_QTY = 9;

export interface PublicImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
}

export interface PublicVariant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  available: boolean; // advisory only — revalidated at checkout
  /** Not available only because an unpaid checkout holds it (D-150). */
  onHold: boolean;
  /** Advisory quantity-picker ceiling — see `MAX_ORDER_QTY`. Never exceeds
   * real stock, but real stock above the cap is never revealed exactly. */
  maxOrderQty: number;
  /** This size's own measurements (D-139), or null to use the product's. */
  measurements: unknown;
}

export interface PublicThrift {
  conditionGrade: ThriftDetails["conditionGrade"];
  conditionNotes: string | null;
  originalBrand: string | null;
  labelledSize: string | null;
  recommendedFit: string | null;
  fabric: string | null;
  measurements: unknown;
  flaws: unknown;
  alterations: string | null;
  authenticityNotes: string | null;
  careNotes: string | null;
  isOneOfOne: boolean;
  // NOTE: acquisitionCostPaise / acquisitionDate are intentionally absent.
}

export interface PublicProductCard {
  catalog: CatalogType;
  slug: string;
  title: string;
  brand: string | null;
  isThrift: boolean;
  isOneOfOne: boolean;
  primaryImage: PublicImage | null;
  fromPricePaise: number | null;
  compareAtPaise: number | null;
  availability: PublicAvailability;
  /** Distinct, non-empty variant sizes on this product (e.g. ["S", "M"] for a
   * Closet listing carrying more than one size) — drives the size filter and
   * a size badge on the card. Empty when no variant has a size set. */
  sizes: string[];
}

export interface PublicProductDetail extends PublicProductCard {
  description: string;
  metaTitle: string | null;
  metaDescription: string | null;
  images: PublicImage[];
  variants: PublicVariant[];
  thrift: PublicThrift | null;
  collections: { slug: string; name: string }[];
}

export function variantAvailable(
  v: Pick<ProductVariant, "onHandQty" | "reservedQty" | "isActive">,
): boolean {
  return v.isActive && v.onHandQty - v.reservedQty > 0;
}

/** In stock, but every unit is held by an unpaid checkout (D-150). */
export function variantOnHold(
  v: Pick<ProductVariant, "onHandQty" | "reservedQty" | "isActive">,
): boolean {
  return v.isActive && v.onHandQty > 0 && v.onHandQty - v.reservedQty <= 0;
}

export function variantMaxOrderQty(
  v: Pick<ProductVariant, "onHandQty" | "reservedQty" | "isActive">,
): number {
  if (!v.isActive) return 0;
  return Math.max(0, Math.min(v.onHandQty - v.reservedQty, MAX_ORDER_QTY));
}

export function deriveAvailability(
  catalog: CatalogType,
  isOneOfOne: boolean,
  variants: Pick<ProductVariant, "onHandQty" | "reservedQty" | "isActive">[],
  markedSoldOut = false,
): PublicAvailability {
  // The owner's manual switch (D-138) wins over stock, which it leaves untouched.
  if (!markedSoldOut && variants.some(variantAvailable)) return "IN_STOCK";
  if (!markedSoldOut && variants.some(variantOnHold)) return "ON_HOLD";
  // Nothing available. A one-of-one thrift piece that has run out is "SOLD"
  // (a permanent state), ordinary apparel is just "OUT_OF_STOCK" (restockable).
  if (catalog === "THRIFT" && isOneOfOne) return "SOLD";
  return "OUT_OF_STOCK";
}

export function toPublicImage(im: ProductImage): PublicImage {
  return {
    url: productImageUrl(im),
    alt: im.altText,
    width: im.widthPx,
    height: im.heightPx,
    isPrimary: im.isPrimary,
  };
}

function fromPrice(variants: ProductVariant[]): number | null {
  const active = variants.filter((v) => v.isActive);
  const pool = (active.length ? active : variants).map((v) => v.pricePaise);
  return pool.length ? Math.min(...pool) : null;
}

function bestCompareAt(variants: ProductVariant[]): number | null {
  const vals = variants
    .filter((v) => v.isActive && v.compareAtPaise != null)
    .map((v) => v.compareAtPaise as number);
  return vals.length ? Math.max(...vals) : null;
}

type ProductRow = {
  catalog: CatalogType;
  slug: string;
  title: string;
  brand: string | null;
  description: string;
  metaTitle: string | null;
  metaDescription: string | null;
  variants: ProductVariant[];
  images: ProductImage[];
  thriftDetails: ThriftDetails | null;
  markedSoldOut?: boolean;
};

export function toPublicCard(p: ProductRow): PublicProductCard {
  const isOneOfOne = p.thriftDetails?.isOneOfOne ?? false;
  const primary =
    [...p.images]
      .sort((a, b) => a.sortPosition - b.sortPosition)
      .find((im) => im.isPrimary) ??
    [...p.images].sort((a, b) => a.sortPosition - b.sortPosition)[0] ??
    null;
  return {
    catalog: p.catalog,
    slug: p.slug,
    title: p.title,
    brand: p.brand,
    isThrift: p.catalog === "THRIFT",
    isOneOfOne,
    primaryImage: primary ? toPublicImage(primary) : null,
    fromPricePaise: fromPrice(p.variants),
    compareAtPaise: bestCompareAt(p.variants),
    availability: deriveAvailability(
      p.catalog,
      isOneOfOne,
      p.variants,
      p.markedSoldOut ?? false,
    ),
    sizes: [...new Set(p.variants.map((v) => v.size).filter((s): s is string => !!s))],
  };
}

export function toPublicDetail(
  p: ProductRow & { collections?: { collection: { slug: string; name: string } }[] },
): PublicProductDetail {
  return {
    ...toPublicCard(p),
    description: p.description,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    images: [...p.images]
      .sort((a, b) => a.sortPosition - b.sortPosition)
      .map(toPublicImage),
    variants: [...p.variants]
      .filter((v) => v.isActive)
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        pricePaise: v.pricePaise,
        compareAtPaise: v.compareAtPaise,
        available: !p.markedSoldOut && variantAvailable(v),
        onHold: !p.markedSoldOut && variantOnHold(v),
        maxOrderQty: p.markedSoldOut ? 0 : variantMaxOrderQty(v),
        measurements: v.measurements ?? null,
      })),
    thrift: p.thriftDetails
      ? {
          conditionGrade: p.thriftDetails.conditionGrade,
          conditionNotes: p.thriftDetails.conditionNotes,
          originalBrand: p.thriftDetails.originalBrand,
          labelledSize: p.thriftDetails.labelledSize,
          recommendedFit: p.thriftDetails.recommendedFit,
          fabric: p.thriftDetails.fabric,
          measurements: p.thriftDetails.measurements,
          flaws: p.thriftDetails.flaws,
          alterations: p.thriftDetails.alterations,
          authenticityNotes: p.thriftDetails.authenticityNotes,
          careNotes: p.thriftDetails.careNotes,
          isOneOfOne: p.thriftDetails.isOneOfOne,
        }
      : null,
    collections: (p.collections ?? []).map((pc) => ({
      slug: pc.collection.slug,
      name: pc.collection.name,
    })),
  };
}

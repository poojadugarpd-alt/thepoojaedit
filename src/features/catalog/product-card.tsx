import Image from "next/image";
import Link from "next/link";

import { SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";
import type { PublicProductCard } from "@/server/catalog/public-shape";

import { Price } from "./price";

export function ProductCard({ product }: { product: PublicProductCard }) {
  const segment = SEGMENT_BY_CATALOG[product.catalog];
  const href = `/${segment}/${product.slug}`;
  const img = product.primaryImage;
  // A "Notify me" piece (D-178) isn't sold out, just not on sale yet.
  const sold =
    !product.notifyOnly &&
    (product.availability === "SOLD" || product.availability === "OUT_OF_STOCK");
  const tag = product.notifyOnly
    ? "Coming soon"
    : product.availability === "SOLD"
      ? "SOLD"
      : product.availability === "OUT_OF_STOCK"
        ? "Sold out"
        : product.availability === "ON_HOLD"
          ? "On hold"
          : product.isThrift && product.isOneOfOne
            ? "One of one"
            : null;

  return (
    <Link href={href} className="group flex flex-col">
      <div className="u-card-panel">
        {img ? (
          <Image
            src={img.url}
            alt={img.alt}
            fill
            sizes="(max-width: 640px) 78vw, (max-width: 1024px) 40vw, 320px"
            className={`object-cover transition-opacity duration-300 group-hover:opacity-90 ${
              sold ? "opacity-60" : ""
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-soft">
            No image
          </div>
        )}
        {tag && <span className="u-card-tag">{tag}</span>}
      </div>

      {/* Phones: name on its own line(s) with the price below it, so the whole
          name is readable. From the sm breakpoint the price sits beside it. */}
      <div className="mt-3.5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
        <h3 className="u-card-title min-w-0 sm:flex-1">{product.title}</h3>
        <Price
          pricePaise={product.fromPricePaise}
          compareAtPaise={product.compareAtPaise}
          fromPrefix={!product.isThrift}
          className="shrink-0 text-[0.85rem]"
        />
      </div>
      {product.brand && (
        <p className="mt-1 text-[0.85rem] text-ink-soft [overflow-wrap:anywhere]">
          {product.brand}
        </p>
      )}
    </Link>
  );
}

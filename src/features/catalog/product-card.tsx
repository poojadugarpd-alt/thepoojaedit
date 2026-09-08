import Image from "next/image";
import Link from "next/link";

import { SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";
import type { PublicProductCard } from "@/server/catalog/public-shape";

import { Price } from "./price";

export function ProductCard({ product }: { product: PublicProductCard }) {
  const segment = SEGMENT_BY_CATALOG[product.catalog];
  const href = `/${segment}/${product.slug}`;
  const img = product.primaryImage;
  const sold = product.availability === "SOLD";
  const tag = sold ? "SOLD" : product.isThrift ? "One of one" : null;

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

      <div className="mt-3.5 flex items-baseline gap-3">
        <h3 className="u-label min-w-0 flex-1 truncate">{product.title}</h3>
        <Price
          pricePaise={product.fromPricePaise}
          compareAtPaise={product.compareAtPaise}
          fromPrefix={!product.isThrift}
          className="shrink-0 text-[0.85rem]"
        />
      </div>
      {product.brand && (
        <p className="mt-1 truncate text-[0.85rem] text-ink-soft">{product.brand}</p>
      )}
    </Link>
  );
}

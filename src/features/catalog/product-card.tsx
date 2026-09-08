import Image from "next/image";
import Link from "next/link";

import { SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";
import type { PublicProductCard } from "@/server/catalog/public-shape";

import { AvailabilityBadge } from "./availability-badge";
import { Price } from "./price";

export function ProductCard({ product }: { product: PublicProductCard }) {
  const segment = SEGMENT_BY_CATALOG[product.catalog];
  const href = `/${segment}/${product.slug}`;
  const img = product.primaryImage;
  const sold = product.availability === "SOLD";

  return (
    <Link href={href} className="group flex flex-col">
      <div className="u-media relative aspect-[3/4] w-full">
        {img ? (
          <Image
            src={img.url}
            alt={img.alt}
            fill
            sizes="(max-width: 640px) 72vw, (max-width: 1024px) 33vw, 300px"
            className={`object-cover transition-opacity duration-300 group-hover:opacity-90 ${
              sold ? "opacity-60" : ""
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-soft">
            No image
          </div>
        )}
        {sold ? (
          <span className="absolute left-3 top-3 rounded-full bg-ground/90 px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-ink-strong">
            SOLD
          </span>
        ) : (
          product.isThrift && (
            <span className="absolute left-3 top-3 rounded-full bg-ground/90 px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-ink-strong">
              One of one
            </span>
          )
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-1.5">
        <h3 className="u-label">{product.title}</h3>
        {product.brand && <p className="text-[0.9rem] text-ink-soft">{product.brand}</p>}
        <div className="mt-auto flex items-center gap-3 pt-1">
          <Price
            pricePaise={product.fromPricePaise}
            compareAtPaise={product.compareAtPaise}
            fromPrefix={!product.isThrift}
            className="text-[0.95rem]"
          />
          {product.availability === "OUT_OF_STOCK" && (
            <AvailabilityBadge availability={product.availability} />
          )}
        </div>
      </div>
    </Link>
  );
}

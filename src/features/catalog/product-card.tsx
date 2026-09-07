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
    <Link
      href={href}
      className="group flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-black/5 dark:bg-white/10">
        {img ? (
          <Image
            src={img.url}
            alt={img.alt}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            className={`object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
              sold ? "opacity-70" : ""
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-black/40 dark:text-white/40">
            No image
          </div>
        )}
        {sold && (
          <span className="absolute left-2 top-2 rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
            SOLD
          </span>
        )}
        {product.isThrift && !sold && (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Thrift
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-1 flex-col gap-1">
        <h3 className="text-sm font-medium leading-snug group-hover:underline underline-offset-2">
          {product.title}
        </h3>
        {product.brand && (
          <p className="text-xs text-black/55 dark:text-white/55">{product.brand}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1">
          <Price
            pricePaise={product.fromPricePaise}
            compareAtPaise={product.compareAtPaise}
            fromPrefix={!product.isThrift}
            className="text-sm"
          />
          {product.availability !== "IN_STOCK" && (
            <AvailabilityBadge availability={product.availability} />
          )}
        </div>
      </div>
    </Link>
  );
}

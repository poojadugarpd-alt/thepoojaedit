import type { PublicProductCard } from "@/server/catalog/public-shape";

import { ProductCard } from "./product-card";

export function ProductGrid({
  products,
  emptyMessage = "Nothing here yet.",
}: {
  products: PublicProductCard[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-black/15 p-8 text-center text-sm text-black/55 dark:border-white/20 dark:text-white/55">
        {emptyMessage}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={`${p.catalog}:${p.slug}`}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}

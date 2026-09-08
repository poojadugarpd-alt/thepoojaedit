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
    return <p className="py-16 text-[0.95rem] text-ink-soft">{emptyMessage}</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-12 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
      {products.map((p) => (
        <li key={`${p.catalog}:${p.slug}`}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}

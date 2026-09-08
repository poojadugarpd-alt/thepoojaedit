"use client";

import { useCallback, useState } from "react";

import type { PublicProductCard } from "@/server/catalog/public-shape";

import { ProductGrid } from "./product-grid";

/**
 * Progressive "load more" over the keyset cursor. Server renders the first page;
 * this appends subsequent pages from the catalog route handler. Keyboard
 * accessible; announces new results politely.
 */
export function LoadMoreGrid({
  segment,
  sort,
  initialItems,
  initialCursor,
}: {
  segment: string;
  sort: string;
  initialItems: PublicProductCard[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/catalog/${segment}/products`, window.location.origin);
      url.searchParams.set("cursor", cursor);
      url.searchParams.set("sort", sort);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const page: { items: PublicProductCard[]; nextCursor: string | null } =
        await res.json();
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more");
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, segment, sort]);

  return (
    <div>
      <ProductGrid products={items} />
      <p aria-live="polite" className="sr-only">
        Showing {items.length} products
      </p>
      <div className="mt-14 flex flex-col items-center gap-3">
        {error && <p className="text-sm text-ink">{error}</p>}
        {cursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="u-pill u-pill--ghost"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : (
          items.length > 0 && (
            <p className="u-eyebrow">That&rsquo;s everything</p>
          )
        )}
      </div>
    </div>
  );
}

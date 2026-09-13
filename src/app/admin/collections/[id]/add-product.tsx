"use client";

import { useEffect, useState } from "react";

import type { CatalogType } from "@/generated/prisma";
import { ActionForm } from "@/features/admin/action-form";

import { addProductToCollectionAction, searchAddableProductsAction, type AddableProduct } from "../actions";

/**
 * Live search-as-you-type over published, not-yet-member products in this
 * collection's own catalogue (Part B3). A plain debounced call to a server
 * action, not a `<form>` — the same not-a-form-submit pattern as the image
 * uploader's upload-ticket request (src/features/admin/image-uploader.tsx).
 * Picking a result is a real tiny `<form>` (one hidden `productId`), matching
 * every other single-purpose row action in this admin.
 */
export function AddProduct({
  collectionId,
  catalog,
}: {
  collectionId: string;
  catalog: CatalogType;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AddableProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchAddableProductsAction(collectionId, catalog, query)
        .then(setResults)
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, collectionId, catalog]);

  return (
    <div className="space-y-2">
      <label htmlFor="add-product-q" className="block text-xs font-medium">
        Add a product
      </label>
      <input
        id="add-product-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search published products by title…"
        className="min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm"
      />
      {loading && <p className="text-xs text-ink-soft">Searching…</p>}
      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-ink-soft">
          No matching published products (already-added and unpublished products
          don&rsquo;t show here).
        </p>
      )}
      {results.length > 0 && (
        <ul className="divide-y divide-line rounded border border-line">
          {results.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="truncate text-sm text-ink-strong">{p.title}</span>
              <ActionForm
                action={addProductToCollectionAction.bind(null, collectionId)}
                submitLabel="Add"
                compact
              >
                <input type="hidden" name="productId" value={p.id} />
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import { ActionForm } from "@/features/admin/action-form";
import { Thumb } from "@/features/admin/format";

import {
  addLookItemAction,
  searchProductsForLookAction,
  type LookSearchResult,
} from "../actions";

const CATALOG = { THE_POOJA_EDIT: "Label", THRIFT: "Closet" } as const;

/** Search published Label + Closet pieces and add one to this Look. */
export function AddPiece({ lookId }: { lookId: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LookSearchResult>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchProductsForLookAction(lookId, query)
        .then(setResults)
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, lookId]);

  return (
    <div className="space-y-2">
      <label htmlFor="add-piece-q" className="block text-xs font-medium">
        Add a piece
      </label>
      <input
        id="add-piece-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search Label and Closet by title…"
        className="min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm"
      />
      {loading && <p className="text-xs text-ink-soft">Searching…</p>}
      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-ink-soft">
          No matching published pieces (ones already in this Look don&rsquo;t show).
        </p>
      )}
      {results.length > 0 && (
        <ul className="divide-y divide-line rounded border border-line">
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <Thumb url={p.image} alt={p.title} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink-strong">
                  {p.title}
                </span>
                <span className="block text-xs text-ink-soft">
                  {CATALOG[p.catalog]}
                </span>
              </span>
              <ActionForm
                action={addLookItemAction.bind(null, lookId)}
                submitLabel="Add"
                compact
                reloadOnSuccess
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

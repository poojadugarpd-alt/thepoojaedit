"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CatalogType } from "@/lib/catalog-routes";

/**
 * Persisted cart (master spec §4).
 *
 * - Entries hold a variant id + quantity plus a display snapshot. The server
 *   revalidates price and stock at checkout — nothing here is authoritative.
 * - Adding to cart NEVER reserves stock.
 * - A mixed cart (both catalogs) is supported; each line keeps its catalog and a
 *   return-policy note.
 */
export interface CartLine {
  variantId: string;
  catalog: CatalogType;
  productSlug: string;
  productTitle: string;
  variantLabel: string | null; // e.g. "M" / "Waist 26"
  unitPricePaise: number; // advisory snapshot at add time
  quantity: number;
  imageUrl: string | null;
  /** Per-item return policy disclosure (master §4). */
  returnPolicyNote: string;
  addedAt: number;
}

export type AddLineInput = Omit<CartLine, "quantity" | "addedAt"> & {
  quantity?: number;
  /** THRIFT one-of-one lines can never exceed 1. */
  maxQuantity?: number;
};

interface CartState {
  lines: CartLine[];
  hydrated: boolean;
  addLine: (input: AddLineInput) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeLine: (variantId: string) => void;
  clear: () => void;
}

const clampQty = (q: number, max?: number) =>
  Math.max(1, Math.min(Math.floor(q) || 1, max ?? 99));

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      hydrated: false,

      addLine: (input) =>
        set((state) => {
          const qty = clampQty(input.quantity ?? 1, input.maxQuantity);
          const existing = state.lines.find((l) => l.variantId === input.variantId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.variantId === input.variantId
                  ? { ...l, quantity: clampQty(l.quantity + qty, input.maxQuantity) }
                  : l,
              ),
            };
          }
          const { maxQuantity: _omit, ...rest } = input;
          void _omit;
          return {
            lines: [...state.lines, { ...rest, quantity: qty, addedAt: Date.now() }],
          };
        }),

      setQuantity: (variantId, quantity) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.variantId === variantId ? { ...l, quantity: clampQty(quantity) } : l,
          ),
        })),

      removeLine: (variantId) =>
        set((state) => ({
          lines: state.lines.filter((l) => l.variantId !== variantId),
        })),

      clear: () => set({ lines: [] }),
    }),
    {
      name: "pe-cart-v1",
      partialize: (s) => ({ lines: s.lines }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

// ---- selectors -------------------------------------------------------
export const selectCount = (s: CartState) =>
  s.lines.reduce((n, l) => n + l.quantity, 0);

export const selectSubtotalPaise = (s: CartState) =>
  s.lines.reduce((sum, l) => sum + l.unitPricePaise * l.quantity, 0);

/**
 * Group cart lines by catalog. NOT a store selector — it builds a new object,
 * which would break `useSyncExternalStore`. Call it inside `useMemo(…, [lines])`.
 */
export function groupByCatalog(lines: CartLine[]): Record<CatalogType, CartLine[]> {
  const groups: Record<CatalogType, CartLine[]> = { THE_POOJA_EDIT: [], THRIFT: [] };
  for (const l of lines) groups[l.catalog].push(l);
  return groups;
}

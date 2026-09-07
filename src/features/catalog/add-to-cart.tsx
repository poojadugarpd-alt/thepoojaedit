"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useCart } from "@/features/cart/store";
import type { CatalogType } from "@/lib/catalog-routes";
import { formatPaiseINR } from "@/lib/money";
import type { PublicAvailability, PublicVariant } from "@/server/catalog/public-shape";

export function AddToCart({
  catalog,
  productSlug,
  productTitle,
  variants,
  imageUrl,
  availability,
  isOneOfOne,
  returnPolicyNote,
}: {
  catalog: CatalogType;
  productSlug: string;
  productTitle: string;
  variants: PublicVariant[];
  imageUrl: string | null;
  availability: PublicAvailability;
  isOneOfOne: boolean;
  returnPolicyNote: string;
}) {
  const addLine = useCart((s) => s.addLine);
  const buyable = variants.filter((v) => v.available);
  const [variantId, setVariantId] = useState(buyable[0]?.id ?? variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const selected = useMemo(
    () => variants.find((v) => v.id === variantId) ?? null,
    [variants, variantId],
  );
  const maxQty = isOneOfOne ? 1 : 9;
  const canAdd = availability !== "SOLD" && selected?.available === true;

  if (availability === "SOLD") {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
        This piece has sold. It was one of one, so it won&rsquo;t be restocked —
        <Link
          href={`/${catalog === "THRIFT" ? "thrift" : "the-pooja-edit"}`}
          className="ml-1 underline"
        >
          see what else is in.
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {variants.length > 1 && (
        <div>
          <label htmlFor="variant" className="block text-sm font-medium">
            {catalog === "THRIFT" ? "Size" : "Choose a size"}
          </label>
          <select
            id="variant"
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setAdded(false);
            }}
            className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.available}>
                {v.size ?? v.sku}
                {!v.available ? " — unavailable" : ""}
                {v.pricePaise !== variants[0].pricePaise
                  ? ` (${formatPaiseINR(v.pricePaise)})`
                  : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isOneOfOne && (
        <div>
          <label htmlFor="qty" className="block text-sm font-medium">
            Quantity
          </label>
          <input
            id="qty"
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            onChange={(e) =>
              setQty(Math.max(1, Math.min(Number(e.target.value) || 1, maxQty)))
            }
            className="mt-1 w-24 rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
          />
        </div>
      )}

      <button
        type="button"
        disabled={!canAdd}
        onClick={() => {
          if (!selected) return;
          addLine({
            variantId: selected.id,
            catalog,
            productSlug,
            productTitle,
            variantLabel: selected.size ?? null,
            unitPricePaise: selected.pricePaise,
            quantity: isOneOfOne ? 1 : qty,
            maxQuantity: maxQty,
            imageUrl,
            returnPolicyNote,
          });
          setAdded(true);
        }}
        className="w-full rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {canAdd ? "Add to cart" : "Unavailable"}
      </button>

      <p aria-live="polite" className="min-h-[1.25rem] text-sm">
        {added && (
          <span className="text-emerald-700 dark:text-emerald-400">
            Added to cart.{" "}
            <Link href="/cart" className="underline">
              View cart
            </Link>
          </span>
        )}
      </p>

      <p className="text-xs text-black/55 dark:text-white/55">{returnPolicyNote}</p>
    </div>
  );
}

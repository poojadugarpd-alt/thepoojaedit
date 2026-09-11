"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useCart } from "@/features/cart/store";
import { SEGMENT_BY_CATALOG, type CatalogType } from "@/lib/catalog-routes";
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
      <div className="rounded-[10px] border border-line bg-fill p-4 text-[0.95rem] text-ink">
        This piece has sold. It was one of one, so it won&rsquo;t be restocked —
        <Link
          href={`/${SEGMENT_BY_CATALOG[catalog]}`}
          className="ml-1 underline underline-offset-2 hover:opacity-70"
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
          <label htmlFor="variant" className="u-label block">
            {catalog === "THRIFT" ? "Size" : "Choose a size"}
          </label>
          <select
            id="variant"
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setAdded(false);
            }}
            className="mt-2 w-full rounded-[10px] border border-line bg-transparent px-3 py-2.5 text-[0.95rem] text-ink focus-visible:border-ink-strong"
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
          <label htmlFor="qty" className="u-label block">
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
            className="mt-2 w-24 rounded-[10px] border border-line bg-transparent px-3 py-2.5 text-[0.95rem] text-ink focus-visible:border-ink-strong"
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
        className="u-pill w-full"
      >
        {canAdd ? "Add to cart" : "Unavailable"}
      </button>

      <p aria-live="polite" className="min-h-[1.25rem] text-[0.95rem]">
        {added && (
          <span className="text-ink">
            Added to cart.{" "}
            <Link href="/cart" className="underline underline-offset-2 hover:opacity-70">
              View cart
            </Link>
          </span>
        )}
      </p>

      <p className="text-xs text-ink-soft">{returnPolicyNote}</p>
    </div>
  );
}

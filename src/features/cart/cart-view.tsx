"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import {
  CATALOG_LABEL,
  productPath,
  SEGMENT_BY_CATALOG,
  type CatalogType,
} from "@/lib/catalog-routes";
import { formatPaiseINR } from "@/lib/money";

import {
  groupByCatalog,
  selectCount,
  selectSubtotalPaise,
  useCart,
  type CartLine,
} from "./store";

function Line({ line }: { line: CartLine }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const removeLine = useCart((s) => s.removeLine);
  return (
    <li className="flex gap-5 py-6">
      <div className="u-media relative h-28 w-24 shrink-0">
        {line.imageUrl && (
          <Image
            src={line.imageUrl}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <Link
          href={productPath(line.catalog, line.productSlug)}
          className="u-label hover:opacity-70"
        >
          {line.productTitle}
        </Link>
        {line.variantLabel && (
          <span className="mt-1 text-[0.85rem] text-ink-soft">{line.variantLabel}</span>
        )}
        <span className="mt-1 text-[0.95rem] text-ink">
          {formatPaiseINR(line.unitPricePaise)}
        </span>
        <p className="mt-1 text-xs text-ink-soft">{line.returnPolicyNote}</p>
        <div className="mt-3 flex items-center gap-4">
          <label className="sr-only" htmlFor={`qty-${line.variantId}`}>
            Quantity for {line.productTitle}
          </label>
          <input
            id={`qty-${line.variantId}`}
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
            className="w-16 rounded-[10px] border border-line bg-transparent px-2 py-1.5 text-sm text-ink focus-visible:border-ink-strong"
          />
          <button
            type="button"
            onClick={() => removeLine(line.variantId)}
            className="text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink underline underline-offset-4 hover:opacity-60"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="text-[0.95rem] text-ink-strong">
        {formatPaiseINR(line.unitPricePaise * line.quantity)}
      </div>
    </li>
  );
}

export function CartView() {
  const hydrated = useCart((s) => s.hydrated);
  const lines = useCart((s) => s.lines);
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotalPaise);
  const groups = useMemo(() => groupByCatalog(lines), [lines]);

  if (!hydrated) {
    return <p className="text-[0.95rem] text-ink-soft">Loading your cart…</p>;
  }

  if (count === 0) {
    return (
      <div className="border-t border-line py-16">
        <p className="u-h3">Your cart is empty.</p>
        <div className="mt-6 flex gap-6">
          <Link href={`/${SEGMENT_BY_CATALOG.THE_POOJA_EDIT}`} className="u-textlink">
            {CATALOG_LABEL.THE_POOJA_EDIT}
          </Link>
          <Link href={`/${SEGMENT_BY_CATALOG.THRIFT}`} className="u-textlink">
            {CATALOG_LABEL.THRIFT}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
      <div>
        {(Object.keys(groups) as CatalogType[])
          .filter((c) => groups[c].length > 0)
          .map((c) => (
            <section key={c} className="mb-10">
              <h2 className="u-label">{CATALOG_LABEL[c]}</h2>
              <ul className="mt-2 divide-y divide-line border-t border-line">
                {groups[c].map((line) => (
                  <Line key={line.variantId} line={line} />
                ))}
              </ul>
            </section>
          ))}
      </div>

      <aside className="h-fit border-t border-line pt-6">
        <h2 className="u-label">Summary</h2>
        <div className="mt-4 flex justify-between text-[0.95rem] text-ink">
          <span>
            Subtotal ({count} item{count === 1 ? "" : "s"})
          </span>
          <span className="text-ink-strong">{formatPaiseINR(subtotal)}</span>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Prices and availability are confirmed at checkout. Shipping and taxes
          calculated there.
        </p>
        <Link href="/checkout" className="u-pill mt-6 w-full">
          Proceed to checkout
        </Link>
      </aside>
    </div>
  );
}

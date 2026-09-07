"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { CATALOG_LABEL, productPath, type CatalogType } from "@/lib/catalog-routes";
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
    <li className="flex gap-4 py-4">
      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded bg-black/5 dark:bg-white/10">
        {line.imageUrl && (
          <Image
            src={line.imageUrl}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <Link
          href={productPath(line.catalog, line.productSlug)}
          className="text-sm font-medium hover:underline"
        >
          {line.productTitle}
        </Link>
        {line.variantLabel && (
          <span className="text-xs text-black/55 dark:text-white/55">
            {line.variantLabel}
          </span>
        )}
        <span className="mt-1 text-sm">{formatPaiseINR(line.unitPricePaise)}</span>
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          {line.returnPolicyNote}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <label className="sr-only" htmlFor={`qty-${line.variantId}`}>
            Quantity for {line.productTitle}
          </label>
          <input
            id={`qty-${line.variantId}`}
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
            className="w-16 rounded border border-black/20 bg-transparent px-2 py-1 text-sm dark:border-white/25"
          />
          <button
            type="button"
            onClick={() => removeLine(line.variantId)}
            className="text-xs text-black/55 underline hover:text-rose-600 dark:text-white/55"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="text-sm font-medium">
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
    return (
      <p className="text-sm text-black/50 dark:text-white/50">Loading your cart…</p>
    );
  }

  if (count === 0) {
    return (
      <div className="rounded-md border border-dashed border-black/15 p-10 text-center dark:border-white/20">
        <p className="text-sm text-black/60 dark:text-white/60">Your cart is empty.</p>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <Link href="/the-pooja-edit" className="underline">
            The Pooja Edit
          </Link>
          <Link href="/thrift" className="underline">
            Thrift Store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div>
        {(Object.keys(groups) as CatalogType[])
          .filter((c) => groups[c].length > 0)
          .map((c) => (
            <section key={c} className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-black/55 dark:text-white/55">
                {CATALOG_LABEL[c]}
              </h2>
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {groups[c].map((line) => (
                  <Line key={line.variantId} line={line} />
                ))}
              </ul>
            </section>
          ))}
      </div>

      <aside className="h-fit rounded-lg border border-black/10 p-5 dark:border-white/15">
        <h2 className="text-sm font-semibold">Summary</h2>
        <div className="mt-3 flex justify-between text-sm">
          <span>
            Subtotal ({count} item{count === 1 ? "" : "s"})
          </span>
          <span className="font-medium">{formatPaiseINR(subtotal)}</span>
        </div>
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">
          Prices and availability are confirmed at checkout. Shipping and taxes
          calculated there.
        </p>
        <Link
          href="/checkout"
          className="mt-4 block rounded-full bg-foreground px-6 py-3 text-center text-sm font-semibold text-background hover:opacity-90"
        >
          Proceed to checkout
        </Link>
      </aside>
    </div>
  );
}

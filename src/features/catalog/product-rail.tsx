"use client";

import { useCallback, useRef } from "react";

import type { PublicProductCard } from "@/server/catalog/public-shape";

import { ProductCard } from "./product-card";

/**
 * Horizontal product carousel — scroll-snap on touch, circular prev/next
 * controls on pointer devices. No auto-advance.
 */
export function ProductRail({ products }: { products: PublicProductCard[] }) {
  const ref = useRef<HTMLDivElement>(null);

  const nudge = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const step = el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  return (
    <div>
      <div ref={ref} className="u-rail">
        {products.map((p) => (
          <ProductCard key={`${p.catalog}:${p.slug}`} product={p} />
        ))}
      </div>
      {products.length > 2 && (
        <div className="mt-6 hidden justify-end gap-3 sm:flex">
          <button
            type="button"
            className="u-railbtn"
            aria-label="Previous products"
            onClick={() => nudge(-1)}
          >
            <Arrow dir="left" />
          </button>
          <button
            type="button"
            className="u-railbtn"
            aria-label="Next products"
            onClick={() => nudge(1)}
          >
            <Arrow dir="right" />
          </button>
        </div>
      )}
    </div>
  );
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={dir === "left" ? "rotate-180" : ""}
    >
      <path
        d="M6 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

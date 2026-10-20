"use client";

import { useCallback, useRef, type ReactNode } from "react";

/**
 * Horizontal carousel for the /styling photo sections — the same scroll-snap
 * rail and circular prev/next controls as the product rail, for any content.
 * No auto-advance.
 */
export function Rail({
  children,
  count,
  label,
  compact = false,
}: {
  children: ReactNode;
  /** Number of items; the arrows only show when there is something to scroll. */
  count: number;
  /** What the arrows move through, e.g. "designs". */
  label: string;
  /** Narrower items (the plain gallery). */
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const nudge = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  return (
    <div>
      <div
        ref={ref}
        className={`u-rail ${compact ? "u-rail--compact" : "u-rail--photos"}`}
      >
        {children}
      </div>
      {count > (compact ? 3 : 2) && (
        <div className="mt-6 hidden justify-end gap-3 sm:flex">
          <button
            type="button"
            className="u-railbtn"
            aria-label={`Previous ${label}`}
            onClick={() => nudge(-1)}
          >
            <Arrow dir="left" />
          </button>
          <button
            type="button"
            className="u-railbtn"
            aria-label={`Next ${label}`}
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

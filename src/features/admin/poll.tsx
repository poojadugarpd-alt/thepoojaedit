"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Visibility-aware polling (master §10 — "modest admin polling with
 * visibility-aware backoff … no mandatory WebSocket infrastructure").
 *
 * - Only polls while the tab is visible.
 * - Backs off exponentially up to `maxMs` while nothing changes; resets on a
 *   manual refresh or when the tab regains focus.
 * - Calls `router.refresh()` so RSC data re-fetches without a full navigation.
 */
export function Poll({
  baseMs = 15_000,
  maxMs = 120_000,
  label = "Auto-refresh",
}: {
  baseMs?: number;
  maxMs?: number;
  label?: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(true);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const delayRef = useRef(baseMs);

  useEffect(() => {
    if (!on) return;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        setLastAt(Date.now());
        delayRef.current = Math.min(delayRef.current * 1.5, maxMs);
      }
      timer = setTimeout(tick, delayRef.current);
    };
    timer = setTimeout(tick, delayRef.current);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        delayRef.current = baseMs;
        router.refresh();
        setLastAt(Date.now());
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [on, router, baseMs, maxMs]);

  return (
    <div className="flex items-center gap-2 text-[11px] text-ink-soft">
      <label className="flex min-h-11 items-center gap-1.5">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            delayRef.current = baseMs;
          }}
          // The visible text is hidden below sm to keep the mobile top row
          // compact — aria-label keeps an accessible name regardless, since
          // a wrapping <label> loses display:none content from its
          // accessible-name computation (axe: "label" rule, caught by the
          // a11y suite at the 390px viewport it runs at).
          aria-label={label}
          className="h-4 w-4"
        />
        <span className="hidden sm:inline" aria-hidden="true">
          {label}
        </span>
      </label>
      <button
        type="button"
        onClick={() => {
          delayRef.current = baseMs;
          router.refresh();
          setLastAt(Date.now());
        }}
        className="flex min-h-11 items-center underline"
      >
        refresh now
      </button>
      {lastAt && <span className="hidden sm:inline">· {new Date(lastAt).toLocaleTimeString("en-IN")}</span>}
    </div>
  );
}

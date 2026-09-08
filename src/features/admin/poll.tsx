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
    <div className="flex items-center gap-2 text-[11px] text-black/50 dark:text-white/50">
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            delayRef.current = baseMs;
          }}
        />
        {label}
      </label>
      <button
        type="button"
        onClick={() => {
          delayRef.current = baseMs;
          router.refresh();
          setLastAt(Date.now());
        }}
        className="underline"
      >
        refresh now
      </button>
      {lastAt && <span>· {new Date(lastAt).toLocaleTimeString("en-IN")}</span>}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Bottom sheet for short choices and filters (brief 4b) — mobile only; on
 * `sm:` and up the trigger is hidden and `children` render inline instead
 * (the caller passes the same filter form both places, this component just
 * decides where it appears). Closes on backdrop click, Escape, or a
 * successful action inside it (the caller closes it explicitly after a
 * filter/submit if desired via `onOpenChange`).
 */
export function Sheet({
  trigger,
  title,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded border border-line px-3 py-1.5 text-sm text-ink sm:hidden"
      >
        {trigger}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-strong/30"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="u-safe-bottom absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-ground p-4 outline-none"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id={titleId} className="text-sm font-semibold text-ink-strong">
                {title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center text-xl text-ink-soft"
              >
                ×
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}

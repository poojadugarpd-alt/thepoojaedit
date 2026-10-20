"use client";

import { useState } from "react";

type Result = { ok: true } | { ok: false; message: string };

/**
 * Move earlier / later / remove buttons for one item in a /styling list (a
 * carousel photo or a testimonial). Actions arrive already bound to the item.
 */
export function ListControls({
  moveEarlier,
  moveLater,
  remove,
  removeLabel = "Remove",
  confirmRemove,
}: {
  moveEarlier?: () => Promise<Result>;
  moveLater?: () => Promise<Result>;
  remove: () => Promise<Result>;
  removeLabel?: string;
  /** Ask before removing (e.g. a testimonial with its words and photos). */
  confirmRemove?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function run(action: () => Promise<Result>) {
    setBusy(true);
    setError(null);
    const r = await action();
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
      return;
    }
    // Full reload, not router.refresh() (D-155).
    window.location.reload();
  }

  const btn =
    "min-h-9 min-w-9 rounded border border-line px-2 text-xs font-medium text-ink-strong disabled:opacity-40";

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={btn}
          disabled={busy || !moveEarlier}
          onClick={() => moveEarlier && run(moveEarlier)}
          aria-label="Move earlier"
        >
          ←
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy || !moveLater}
          onClick={() => moveLater && run(moveLater)}
          aria-label="Move later"
        >
          →
        </button>
        {confirmRemove && asking ? (
          <>
            <span className="text-xs text-ink">{confirmRemove}</span>
            <button
              type="button"
              className={`${btn} border-stop text-stop`}
              disabled={busy}
              onClick={() => run(remove)}
            >
              Yes, {removeLabel.toLowerCase()}
            </button>
            <button
              type="button"
              className="min-h-9 text-xs text-ink-soft underline"
              disabled={busy}
              onClick={() => setAsking(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="min-h-9 px-1 text-xs text-ink-soft underline disabled:opacity-40"
            disabled={busy}
            onClick={() => (confirmRemove ? setAsking(true) : run(remove))}
          >
            {removeLabel}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-stop">{error}</p>}
    </div>
  );
}

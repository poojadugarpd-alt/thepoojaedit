"use client";

import { useState } from "react";

import type { CatalogType } from "@/generated/prisma";

/**
 * Moves an already-created product to the other catalogue (owner feedback,
 * 2026-09-16 — before this, the only way to fix a mis-catalogued product was
 * to delete it and rebuild it from scratch). Custom inline confirm, not a
 * native `confirm()` — same convention as `DeleteProductConfirm`. A full page
 * reload on success (not `router.refresh()`) is deliberate: switching
 * catalogues can create/remove the `ThriftDetails` row and drop the product
 * to Draft server-side, and this editor's local state (thrift fields, status,
 * variant matrix) has no way to reconcile itself against that short of
 * refetching everything fresh.
 */
export function SwitchCatalogConfirm({
  productTitle,
  fromCatalog,
  switchAction,
}: {
  productTitle: string;
  fromCatalog: CatalogType;
  switchAction: (target: CatalogType) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target: CatalogType = fromCatalog === "THRIFT" ? "THE_POOJA_EDIT" : "THRIFT";
  const targetLabel = target === "THRIFT" ? "the Closet" : "the Label";

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 rounded border border-line px-4 text-sm font-semibold text-ink"
      >
        Move to {targetLabel}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded border border-line bg-fill p-3">
      <p className="text-sm text-ink">
        Move <strong>{productTitle}</strong> to {targetLabel}? It will be set back to
        Draft so you can review it — {target === "THRIFT"
          ? "you'll need to fill in condition and measurements before publishing again."
          : "its thrift condition/measurement details will be removed."}
      </p>
      {error && <p className="text-sm text-stop">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const res = await switchAction(target);
            if (res.ok) {
              window.location.reload();
              return;
            }
            setBusy(false);
            setError(res.message ?? "Something went wrong.");
          }}
          className="min-h-11 rounded bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Moving…" : `Yes, move to ${targetLabel}`}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="flex min-h-11 items-center text-sm text-ink-soft underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

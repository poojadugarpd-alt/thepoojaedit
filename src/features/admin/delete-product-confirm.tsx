"use client";

import { useState } from "react";

import { ActionForm } from "@/features/admin/action-form";
import type { ActionState } from "@/app/admin/products/actions";

/**
 * Delete is real and permanent when the server allows it at all (owner
 * feedback, 2026-09-13) — this is the one confirmation gate before that
 * happens, naming the actual product rather than a generic "are you sure?".
 * Not a native `confirm()` dialog (consistent with the rest of this admin —
 * everything else here is custom UI, never a browser-native prompt), and
 * deliberately an inline expand rather than a modal so it works the same at
 * any width without new layout machinery.
 */
export function DeleteProductConfirm({
  productTitle,
  deleteAction,
}: {
  productTitle: string;
  deleteAction: (prev: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 rounded border border-stop px-4 text-sm font-semibold text-stop"
      >
        Delete product
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded border border-stop/40 bg-stop-bg/30 p-3">
      <p className="text-sm text-ink">
        Permanently delete <strong>{productTitle}</strong>? Its photos are removed
        from storage too. This cannot be undone.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ActionForm action={deleteAction} submitLabel="Yes, delete permanently" compact>
          <span />
        </ActionForm>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="flex min-h-11 items-center text-sm text-ink-soft underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

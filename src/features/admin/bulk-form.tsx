"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/app/admin/products/actions";

function Submit({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="min-h-11 rounded bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-50"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

/**
 * Checkbox-select + one bulk action. Renders per-record failures from the
 * action's `errors[]` so a partial success is visible (master §10). Each row
 * is a full-width `<label>` so the whole row is the tap target, not just the
 * small checkbox square (brief 4b, ≥44px touch targets).
 */
export function BulkForm({
  action,
  items,
  fieldName = "taskIds",
  submitLabel = "Apply to selected",
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  items: { id: string; node: React.ReactNode }[];
  fieldName?: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, { ok: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = items.length > 0 && selected.size === items.length;

  return (
    <form action={formAction} className="space-y-2">
      <div className="sticky top-14 z-10 -mx-4 space-y-2 bg-ground px-4 py-2 sm:static sm:mx-0 sm:px-0">
        <label className="flex min-h-11 items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) =>
              setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())
            }
            className="h-5 w-5"
          />
          select all ({selected.size}/{items.length})
        </label>
        <div className="flex gap-2">
          <input
            name="reason"
            placeholder="reason (required for bulk)"
            className="min-h-11 min-w-0 flex-1 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
          />
          <Submit label={submitLabel} disabled={selected.size === 0} />
        </div>
      </div>

      <ul className="divide-y divide-line text-sm">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex min-h-11 items-start gap-3 py-3">
              <input
                type="checkbox"
                name={fieldName}
                value={i.id}
                checked={selected.has(i.id)}
                onChange={(e) => {
                  setSelected((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(i.id);
                    else n.delete(i.id);
                    return n;
                  });
                }}
                className="mt-1 h-5 w-5 shrink-0"
              />
              <div className="min-w-0 flex-1">{i.node}</div>
            </label>
          </li>
        ))}
      </ul>

      {state.message && (
        <p className={`text-xs ${state.ok ? "text-ok" : "text-wait"}`}>{state.message}</p>
      )}
      {state.errors && state.errors.length > 0 && (
        <ul className="list-inside list-disc text-xs text-stop">
          {state.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </form>
  );
}

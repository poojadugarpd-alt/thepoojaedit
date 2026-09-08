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
      className="rounded bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

/**
 * Checkbox-select + one bulk action. Renders per-record failures from the
 * action's `errors[]` so a partial success is visible (master §10).
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
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) =>
              setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())
            }
          />
          select all ({selected.size}/{items.length})
        </label>
        <input
          name="reason"
          placeholder="reason (required for bulk)"
          className="min-w-48 flex-1 rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
        />
        <Submit label={submitLabel} disabled={selected.size === 0} />
      </div>

      <ul className="divide-y divide-black/10 text-sm dark:divide-white/10">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-2 py-2">
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
              className="mt-1"
            />
            <div className="min-w-0 flex-1">{i.node}</div>
          </li>
        ))}
      </ul>

      {state.message && (
        <p className={`text-xs ${state.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"}`}>
          {state.message}
        </p>
      )}
      {state.errors && state.errors.length > 0 && (
        <ul className="list-inside list-disc text-xs text-rose-600">
          {state.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </form>
  );
}

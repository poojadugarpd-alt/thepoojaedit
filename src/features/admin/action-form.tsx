"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/app/admin/products/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

export function ActionForm({
  action,
  submitLabel = "Save",
  children,
  className = "",
  compact = false,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  submitLabel?: string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(action, { ok: false });
  return (
    <form action={formAction} className={`space-y-3 ${className}`}>
      {children}
      <div className={`flex items-center gap-3 ${compact ? "" : "pt-1"}`}>
        <Submit label={submitLabel} />
        {state.message && (
          <span
            className={`text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"}`}
          >
            {state.message}
          </span>
        )}
      </div>
      {state.errors && state.errors.length > 0 && (
        <ul className="list-inside list-disc text-sm text-rose-600">
          {state.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        className="mt-1 w-full rounded border border-black/20 bg-transparent px-2 py-1.5 text-sm dark:border-white/25"
      />
      {hint && (
        <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/45">{hint}</p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 4,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? undefined}
        className="mt-1 w-full rounded border border-black/20 bg-transparent px-2 py-1.5 font-mono text-xs dark:border-white/25"
      />
    </div>
  );
}

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
      className="min-h-11 rounded bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
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
          <span className={`text-sm ${state.ok ? "text-ok" : "text-stop"}`}>
            {state.message}
          </span>
        )}
      </div>
      {state.errors && state.errors.length > 0 && (
        <ul className="list-inside list-disc text-sm text-stop">
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
  maxLength,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  /** For `type="number"` — e.g. "0.01" so a rupee amount like 1499.50 doesn't
   * trip the browser's step-mismatch validation (which defaults to whole
   * numbers only). */
  step?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
        {required && <span className="text-stop"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        step={step}
        defaultValue={defaultValue ?? undefined}
        className="mt-1 min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm"
      />
      {hint && <p className="mt-0.5 text-[11px] text-ink-soft">{hint}</p>}
    </div>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 4,
  hint,
  maxLength,
  mono = true,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  hint?: string;
  maxLength?: number;
  /** The settings JSON editor wants a monospace box; prose fields (home page
   * copy) read better in the ordinary text font. */
  mono?: boolean;
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
        maxLength={maxLength}
        defaultValue={defaultValue ?? undefined}
        className={`mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm ${mono ? "font-mono sm:text-xs" : ""}`}
      />
      {hint && <p className="mt-0.5 text-[11px] text-ink-soft">{hint}</p>}
    </div>
  );
}

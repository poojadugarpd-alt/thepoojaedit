"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/app/admin/products/actions";
import { HoldToDelete } from "@/features/admin/hold-to-delete";

function Submit({
  label,
  holdToSubmit = false,
  holdDescription,
  actionVerb,
  compact = false,
}: {
  label: string;
  holdToSubmit?: boolean;
  holdDescription?: string;
  actionVerb?: "delete" | "cancel" | string;
  compact?: boolean;
}) {
  const { pending } = useFormStatus();

  if (holdToSubmit) {
    const verbLabel = label.toLowerCase().replace(/^hold to /, "");
    return (
      <HoldToDelete
        isSubmit
        label={label}
        holdingLabel={`Holding to ${verbLabel}…`}
        completedLabel="Confirmed"
        itemDescription={holdDescription || "item"}
        actionVerb={actionVerb}
        compact={compact}
        disabled={pending}
      />
    );
  }

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
  reloadOnSuccess = false,
  holdToSubmit = false,
  holdDescription,
  actionVerb,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  submitLabel?: string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  /** Full page reload after a successful action, for forms that add to a list
   *  on the same page. Next 15.5's client router intermittently never renders
   *  fresh data it has received for the current page — via an action redirect,
   *  revalidated action data, or router.refresh() alike (no error; blank page
   *  or stale list). A reload always shows the server's current state (D-155). */
  reloadOnSuccess?: boolean;
  /** When true, the submit button requires holding for ~1s before executing */
  holdToSubmit?: boolean;
  /** Descriptive item name for accessibility and screen readers */
  holdDescription?: string;
  /** Action verb for accessibility announcements (e.g. "delete" | "cancel") */
  actionVerb?: "delete" | "cancel" | string;
}) {
  const [state, formAction] = useActionState(action, { ok: false });
  useEffect(() => {
    if (reloadOnSuccess && state.ok) window.location.reload();
  }, [reloadOnSuccess, state]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (holdToSubmit && e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        e.preventDefault();
      }
    }
  };

  return (
    <form
      action={formAction}
      onKeyDown={handleKeyDown}
      className={`space-y-3 ${className}`}
    >
      {children}
      <div className={`flex items-center gap-3 ${compact ? "" : "pt-1"}`}>
        <Submit
          label={submitLabel}
          holdToSubmit={holdToSubmit}
          holdDescription={holdDescription}
          actionVerb={actionVerb}
          compact={compact}
        />
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
  id: idProp,
}: {
  label: string;
  name: string;
  /** Needed when the same field name appears in several forms on one page. */
  id?: string;
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
  const id = idProp ?? `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
        {required && (
          <span className="text-stop" aria-hidden="true">
            {" "}
            *
          </span>
        )}
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
  id: idProp,
}: {
  label: string;
  name: string;
  /** Needed when the same field name appears in several forms on one page. */
  id?: string;
  defaultValue?: string | null;
  rows?: number;
  hint?: string;
  maxLength?: number;
  /** The settings JSON editor wants a monospace box; prose fields (home page
   * copy) read better in the ordinary text font. */
  mono?: boolean;
}) {
  const id = idProp ?? `f-${name}`;
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

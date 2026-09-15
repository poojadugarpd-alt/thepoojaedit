"use client";

import { useState } from "react";

/**
 * A small chip input — type a value, press Enter or "," to add it, click ×
 * to remove. Used for Tags directly, and for entering the Size/Color axis
 * values that `VariantMatrix` turns into a variant grid.
 */
export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState("");
  const id = `pf-tag-${label.toLowerCase().replace(/\s+/g, "-")}`;

  function commit() {
    const v = draft.trim();
    setDraft("");
    if (!v) return;
    if (values.some((existing) => existing.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
  }

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
      </label>
      <div className="mt-1 flex min-h-11 flex-wrap items-center gap-1.5 rounded border border-line px-2 py-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded-full bg-line/60 px-2 py-0.5 text-xs text-ink-strong"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="text-ink-soft hover:text-stop"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            // "," commits immediately, same as Enter — a fast way to add
            // several values without reaching for the mouse or Enter key.
            if (e.target.value.endsWith(",")) {
              setDraft(e.target.value.slice(0, -1));
              commit();
              return;
            }
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : undefined}
          className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-base outline-none sm:text-sm"
        />
      </div>
      {hint && <p className="mt-0.5 text-[11px] text-ink-soft">{hint}</p>}
    </div>
  );
}

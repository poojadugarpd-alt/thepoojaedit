"use client";

/**
 * Controlled siblings of `action-form.tsx`'s `Field`/`TextArea` — same
 * visual tokens (`border-line`, `min-h-11`, `text-base sm:text-sm`) so the
 * product editor matches the rest of `/admin`, but driven by `value`/
 * `onChange` instead of `defaultValue`. `action-form.tsx` itself stays
 * untouched — every other admin page still uses its uncontrolled,
 * `<form action>`-based components.
 */

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  hint,
  maxLength,
  step,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  step?: string;
  id?: string;
}) {
  const inputId = id ?? `pf-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={inputId} className="block text-xs font-medium">
        {label}
        {required && <span className="text-stop"> *</span>}
      </label>
      <input
        id={inputId}
        type={type}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm"
      />
      {hint && <p className="mt-0.5 text-[11px] text-ink-soft">{hint}</p>}
    </div>
  );
}

export function TextAreaInput({
  label,
  value,
  onChange,
  rows = 4,
  hint,
  maxLength,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
  maxLength?: number;
  mono?: boolean;
}) {
  const id = `pf-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm ${mono ? "font-mono sm:text-xs" : ""}`}
      />
      {hint && <p className="mt-0.5 text-[11px] text-ink-soft">{hint}</p>}
    </div>
  );
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  const id = `pf-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-0.5 text-[11px] text-ink-soft">{hint}</p>}
    </div>
  );
}

export function CheckboxInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-xs">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

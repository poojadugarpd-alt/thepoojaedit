"use client";

import { useActionState } from "react";

import { submitEnquiryAction, type EnquiryFormState } from "@/app/styling/actions";

const INPUT =
  "rounded-[10px] border border-line bg-transparent px-3 py-2.5 text-ink focus-visible:border-ink-strong aria-[invalid=true]:border-stop";

function FieldShell({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="u-label u-label--muted">
        {label}
        {hint && <span className="ml-1 normal-case tracking-normal">({hint})</span>}
      </span>
      {children}
      {error && <span className="text-sm text-stop">{error}</span>}
    </label>
  );
}

export function EnquiryForm({ services }: { services: string[] }) {
  const [state, action, pending] = useActionState<EnquiryFormState, FormData>(
    submitEnquiryAction,
    { status: "idle" },
  );

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-[10px] border border-line bg-fill p-6">
        <p className="u-label">Enquiry sent</p>
        <p className="mt-3 text-ink">
          Thank you{state.name ? `, ${state.name.split(" ")[0]}` : ""}. Your enquiry has
          reached Pooja, and she&rsquo;ll reply by email or WhatsApp soon.
        </p>
      </div>
    );
  }

  const v = state.status === "error" ? state.values : {};
  const err = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const field = (name: string) => ({
    name,
    defaultValue: v[name] ?? "",
    "aria-invalid": err[name] ? true : undefined,
    className: INPUT,
  });

  return (
    // After an error, React's form reset restores each field's defaultValue,
    // which is what was typed (sent back in `state.values`).
    <form action={action} className="grid gap-5 sm:grid-cols-2" noValidate>
      <FieldShell label="Name" error={err.name}>
        <input {...field("name")} required maxLength={100} autoComplete="name" />
      </FieldShell>
      <FieldShell label="Email" error={err.email}>
        <input
          {...field("email")}
          type="email"
          required
          maxLength={200}
          autoComplete="email"
        />
      </FieldShell>
      <FieldShell label="WhatsApp" hint="optional" error={err.phone}>
        <input
          {...field("phone")}
          type="tel"
          maxLength={30}
          inputMode="tel"
          autoComplete="tel"
        />
      </FieldShell>
      <FieldShell label="City / country" error={err.location}>
        <input {...field("location")} required maxLength={100} />
      </FieldShell>
      <FieldShell label="Service" error={err.service}>
        <select {...field("service")} required defaultValue={v.service || services[0]}>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FieldShell>
      <FieldShell label="Budget" hint="optional" error={err.budget}>
        <input {...field("budget")} maxLength={60} placeholder="e.g. ₹20,000" />
      </FieldShell>
      <div className="sm:col-span-2">
        <FieldShell label="What are you looking for?" error={err.message}>
          <textarea {...field("message")} required rows={5} maxLength={2000} />
        </FieldShell>
      </div>
      {/* Honeypot: hidden from people and screen readers; bots fill it. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2">
        {state.status === "error" && (
          <p role="alert" className="text-sm text-stop">
            {state.message}
          </p>
        )}
        <button type="submit" disabled={pending} className="u-pill self-start">
          {pending ? "Sending…" : "Send enquiry"}
        </button>
      </div>
    </form>
  );
}

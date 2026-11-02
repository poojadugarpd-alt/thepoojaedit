"use client";

import Script from "next/script";
import { useState } from "react";

const INPUT =
  "rounded-[10px] border border-line bg-transparent px-3 py-2.5 text-ink focus-visible:border-ink-strong aria-[invalid=true]:border-stop";

type Status = "idle" | "sending" | "sent" | "error";

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

/**
 * Leave a review. Posts to /api/reviews (same site). The review is held until
 * Pooja approves it; the email and WhatsApp number are never shown.
 */
export function ReviewForm({
  services,
  invite,
  defaultName,
  defaultService,
  whatsappUrl,
}: {
  services: string[];
  invite?: string;
  defaultName?: string;
  defaultService?: string;
  whatsappUrl?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [sentName, setSentName] = useState("");
  const turnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    setStatus("sending");
    setErrors({});
    setMessage("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: "STYLING",
          service: get("service"),
          rating: get("rating"),
          text: get("text"),
          displayName: get("displayName"),
          instagram: get("instagram"),
          showInstagram: form.get("showInstagram") === "on",
          email: get("email"),
          phone: get("phone"),
          consentPublish: form.get("consentPublish") === "on",
          consentContact: form.get("consentContact") === "on",
          company: get("company"),
          invite,
          turnstileToken: get("cf-turnstile-response"),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        errors?: Record<string, string>;
        error?: string;
      };
      if (res.ok && data.ok) {
        setSentName(get("displayName"));
        setStatus("sent");
        return;
      }
      setStatus("error");
      if (data.errors) setErrors(data.errors);
      setMessage(
        res.status === 429
          ? "You have sent a few reviews just now. Please try again in an hour."
          : data.errors
            ? "Please check the highlighted fields."
            : "Sorry, that did not go through. Please try again, or send your review to Pooja on WhatsApp.",
      );
    } catch {
      setStatus("error");
      setMessage(
        "Sorry, that did not go through. Please check your connection and try again.",
      );
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-[10px] border border-line bg-fill p-6">
        <p className="u-label">Review received</p>
        <p className="mt-3 text-ink">
          Thank you{sentName ? `, ${sentName.split(" ")[0]}` : ""}. Pooja reads every
          review and will put yours on the site once she has approved it.
        </p>
      </div>
    );
  }

  const err = (k: string) => errors[k];
  const invalid = (k: string) => (errors[k] ? true : undefined);

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2" noValidate>
      <FieldShell
        label="Name to show"
        hint="first name is fine"
        error={err("displayName")}
      >
        <input
          name="displayName"
          className={INPUT}
          defaultValue={defaultName ?? ""}
          required
          maxLength={60}
          autoComplete="given-name"
          aria-invalid={invalid("displayName")}
        />
      </FieldShell>
      <FieldShell label="Service" error={err("service")}>
        <select
          name="service"
          className={INPUT}
          defaultValue={defaultService || services[0]}
          required
          aria-invalid={invalid("service")}
        >
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FieldShell>
      <FieldShell label="Email" hint="private, never shown" error={err("email")}>
        <input
          name="email"
          type="email"
          className={INPUT}
          required
          maxLength={200}
          autoComplete="email"
          aria-invalid={invalid("email")}
        />
      </FieldShell>
      <FieldShell label="WhatsApp" hint="optional, private" error={err("phone")}>
        <input
          name="phone"
          type="tel"
          className={INPUT}
          maxLength={30}
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={invalid("phone")}
        />
      </FieldShell>
      <FieldShell label="Instagram" hint="optional" error={err("instagram")}>
        <input
          name="instagram"
          className={INPUT}
          maxLength={31}
          placeholder="@yourhandle"
          autoComplete="off"
          aria-invalid={invalid("instagram")}
        />
      </FieldShell>
      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="u-label u-label--muted">
          Rating <span className="ml-1 normal-case tracking-normal">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {[5, 4, 3, 2, 1].map((n) => (
            <label
              key={n}
              className="flex min-h-11 items-center gap-1.5 rounded-[10px] border border-line px-3"
            >
              <input type="radio" name="rating" value={n} />
              {n} {n === 1 ? "star" : "stars"}
            </label>
          ))}
        </div>
        {err("rating") && <span className="text-sm text-stop">{err("rating")}</span>}
      </fieldset>
      <div className="sm:col-span-2">
        <FieldShell
          label="Your review"
          hint="a sentence or two is plenty"
          error={err("text")}
        >
          <textarea
            name="text"
            className={INPUT}
            required
            rows={5}
            maxLength={1500}
            aria-invalid={invalid("text")}
          />
        </FieldShell>
      </div>

      <div className="flex flex-col gap-3 text-sm sm:col-span-2">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consentPublish" className="mt-1" required />
          <span>
            You can show my review and the name above on the website.
            {err("consentPublish") && (
              <span className="mt-1 block text-stop">{err("consentPublish")}</span>
            )}
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="showInstagram" className="mt-1" />
          <span>Show my Instagram handle with it too.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consentContact" className="mt-1" />
          <span>Pooja may contact me about my review.</span>
        </label>
        <p className="text-ink-soft">
          Your email and WhatsApp number stay private. They are kept only so Pooja can
          reach you about your review, and she never shares them. To have your review or
          details removed, message her
          {whatsappUrl ? (
            <>
              {" "}
              on{" "}
              <a className="underline" href={whatsappUrl}>
                WhatsApp
              </a>
            </>
          ) : null}{" "}
          and it is deleted.
        </p>
      </div>

      {/* Honeypot: hidden from people and screen readers; bots fill it. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {turnstileKey && (
        <div className="sm:col-span-2">
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
          />
          <div className="cf-turnstile" data-sitekey={turnstileKey} />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:col-span-2">
        {message && (
          <p role="alert" className="text-sm text-stop">
            {message}
          </p>
        )}
        <div>
          <button type="submit" disabled={status === "sending"} className="u-pill">
            {status === "sending" ? "Sending…" : "Send my review"}
          </button>
        </div>
      </div>
    </form>
  );
}

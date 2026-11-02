"use client";

import { useState } from "react";

import { REVIEWS_API } from "@/lib/reviews";
import { serviceOptions, site, waLink } from "@/lib/site";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Leave a review. Posts to the store's API (the review is held until Pooja
 * approves it). Email and WhatsApp number are private and never shown.
 */
export function ReviewForm({ invite }: { invite?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [sentName, setSentName] = useState("");
  const turnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    setStatus("sending");
    setErrors({});
    setMessage("");
    try {
      const res = await fetch(REVIEWS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: "STUDIO",
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
            : "Sorry, that did not go through. Please try again, or send your review on WhatsApp.",
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
      <div className="form-success" role="status">
        <p className="success-title">
          Thank you{sentName ? `, ${sentName.split(" ")[0]}` : ""}! Pooja reads every
          review and will put yours on the site once she has approved it.
        </p>
      </div>
    );
  }

  const props = (k: string) => ({
    name: k,
    id: `r-${k}`,
    "aria-invalid": errors[k] ? (true as const) : undefined,
    "aria-describedby": errors[k] ? `re-${k}` : undefined,
  });
  const Err = ({ k }: { k: string }) =>
    errors[k] ? (
      <span className="field-err" id={`re-${k}`} role="alert">
        {errors[k]}
      </span>
    ) : null;

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="r-displayName">Name to show</label>
        <input
          {...props("displayName")}
          required
          maxLength={60}
          autoComplete="given-name"
        />
        <Err k="displayName" />
      </div>
      <div className="field">
        <label htmlFor="r-service">Service</label>
        <select {...props("service")} defaultValue={serviceOptions[0]} required>
          {serviceOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Err k="service" />
      </div>
      <div className="field">
        <label htmlFor="r-email">
          Email <span className="opt">private, never shown</span>
        </label>
        <input
          {...props("email")}
          type="email"
          required
          maxLength={200}
          autoComplete="email"
        />
        <Err k="email" />
      </div>
      <div className="field">
        <label htmlFor="r-phone">
          WhatsApp <span className="opt">optional, private</span>
        </label>
        <input
          {...props("phone")}
          type="tel"
          maxLength={30}
          inputMode="tel"
          autoComplete="tel"
        />
        <Err k="phone" />
      </div>
      <div className="field">
        <label htmlFor="r-instagram">
          Instagram handle <span className="opt">optional</span>
        </label>
        <input
          {...props("instagram")}
          placeholder="@yourhandle"
          maxLength={31}
          autoCapitalize="off"
        />
        <Err k="instagram" />
      </div>
      <fieldset className="field rating-field">
        <legend>
          Rating <span className="opt">optional</span>
        </legend>
        <div className="rating-row">
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="rating-opt">
              <input type="radio" name="rating" value={n} /> {n}
            </label>
          ))}
        </div>
        <Err k="rating" />
      </fieldset>
      <div className="field field-full">
        <label htmlFor="r-text">
          Your review <span className="opt">a sentence or two is plenty</span>
        </label>
        <textarea {...props("text")} required rows={5} maxLength={1500} />
        <Err k="text" />
      </div>

      <div className="field field-full consent">
        <label className="check">
          <input type="checkbox" name="consentPublish" required /> You can show my
          review and the name above on the website.
        </label>
        <Err k="consentPublish" />
        <label className="check">
          <input type="checkbox" name="showInstagram" /> Show my Instagram handle with
          it too.
        </label>
        <label className="check">
          <input type="checkbox" name="consentContact" /> Pooja may contact me about my
          review.
        </label>
        <p className="consent-note">
          Your email and WhatsApp number stay private. They are kept only so Pooja can
          reach you about your review, and she never shares them. To have your review or
          details removed, message her on{" "}
          <a
            className="text-link"
            href={waLink("Hi Pooja, please remove my review and details.")}
          >
            WhatsApp
          </a>{" "}
          and it is deleted.
        </p>
      </div>

      <div className="hp" aria-hidden="true">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {turnstileKey && (
        <div className="field-full">
          <script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            async
            defer
          />
          <div className="cf-turnstile" data-sitekey={turnstileKey} />
        </div>
      )}

      <div className="field-full">
        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
        <button className="btn btn-wa" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "send my review"}
        </button>{" "}
        <a
          className="btn btn-ghost"
          href={site.whatsappUrl}
          target="_blank"
          rel="noopener"
        >
          or send it on whatsapp
        </a>
      </div>
    </form>
  );
}

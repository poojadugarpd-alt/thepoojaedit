"use client";

import { useEffect, useState } from "react";
import { useBag } from "./Bag";
import { productById } from "@/lib/products";
import type { PriceKey } from "@/lib/site";
import { serviceOptions, site, waLink } from "@/lib/site";
import { type Enquiry, type EnquiryErrors, validateEnquiry } from "@/lib/enquiry";
import { CheckIcon, InstagramIcon, MailIcon, WhatsAppIcon, YouTubeIcon } from "./icons";

const empty: Enquiry = { name: "", instagram: "", email: "", phone: "", service: "", message: "", footage: "" };

type Status = "idle" | "sending" | "done" | "error";

export function ChatPanel() {
  const [form, setForm] = useState<Enquiry>(empty);
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Enquiry, boolean>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverMsg, setServerMsg] = useState("");
  const bag = useBag();

  // Coming from the bag: prefill the brief with the order summary.
  useEffect(() => {
    const ids = Object.keys(bag.lines) as PriceKey[];
    if (!ids.length) return;
    const service = ids.length === 1 ? productById[ids[0]].workTab : "";
    const svcLabel = { reels: "Instagram Reels", youtube: "YouTube Long Form", carousels: "Instagram Carousels", graphics: "Graphics" }[service] ?? "Other";
    setForm((f) => (f.message ? f : { ...f, service: f.service || svcLabel, message: `My order:\n${bag.summary()}\n\n` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof Enquiry) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const next = { ...form, [k]: e.target.value };
    setForm(next);
    if (touched[k]) setErrors(validateEnquiry(next));
  };
  const blur = (k: keyof Enquiry) => () => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors(validateEnquiry(form));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validateEnquiry(form);
    setErrors(errs);
    setTouched(Object.fromEntries(Object.keys(empty).map((k) => [k, true])));
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    setStatus("sending");
    try {
      const honeypot = (e.currentTarget.elements.namedItem("company") as HTMLInputElement)?.value;
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, company: honeypot }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setStatus("done");
        setForm(empty);
        setTouched({});
        return;
      }
      if (json.errors) setErrors(json.errors);
      setServerMsg(
        json.error === "not_configured" || json.error === "delivery_failed"
          ? "We couldn’t send this right now. Please message us on WhatsApp instead — it’s the fastest way to reach us."
          : "Something went wrong. Please check the form, or message us on WhatsApp.",
      );
      setStatus("error");
    } catch {
      setServerMsg("You seem to be offline. Please try again, or message us on WhatsApp.");
      setStatus("error");
    }
  };

  const err = (k: keyof Enquiry) => (touched[k] ? errors[k] : undefined);
  const field = (k: keyof Enquiry) => ({
    id: `f-${k}`,
    name: k,
    value: form[k],
    onChange: set(k),
    onBlur: blur(k),
    "aria-invalid": err(k) ? true : undefined,
    "aria-describedby": err(k) ? `e-${k}` : undefined,
  });
  const Err = ({ k }: { k: keyof Enquiry }) =>
    err(k) ? (
      <span className="field-err" id={`e-${k}`} role="alert">
        {err(k)}
      </span>
    ) : null;

  const brief = [
    "Hi Pooja!",
    form.name && `I'm ${form.name}${form.instagram ? ` (${form.instagram})` : ""}.`,
    form.service && `I'm looking for: ${form.service}.`,
    form.message,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="chat">
      <header className="panel-head panel-head-solo">
        <div>
          <h2 className="h2">Let’s Create Something</h2>
          <p className="lede">Share your details and we’ll get back within 24 hours.</p>
        </div>
      </header>

      <div className="chat-grid">
        <aside className="contact-card">
          <a className="btn btn-wa btn-lg btn-block" href={waLink()} target="_blank" rel="noopener">
            <WhatsAppIcon /> Chat on WhatsApp
          </a>
          <p className="contact-hint">Fastest reply · {site.whatsappDisplay}</p>
          <ul className="contact-list">
            <li>
              <a href={`mailto:${site.email}`}>
                <MailIcon size={18} /> <span>{site.email}</span>
              </a>
            </li>
            <li>
              <a href={site.instagramUrl} target="_blank" rel="noopener">
                <InstagramIcon size={18} /> <span>DM {site.instagramHandle}</span>
              </a>
            </li>
            <li>
              <a href={site.youtubeUrl} target="_blank" rel="noopener">
                <YouTubeIcon size={18} /> <span>{site.youtubeHandle} on YouTube</span>
              </a>
            </li>
          </ul>
        </aside>

        {status === "done" ? (
          <div className="form-success" role="status">
            <span className="success-icon">
              <CheckIcon size={26} />
            </span>
            <p className="success-title">Thanks! Your details have been received. We’ll be in touch shortly.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => setStatus("idle")}>
              Send another enquiry
            </button>
          </div>
        ) : (
          <form className="form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="f-name">Name</label>
              <input {...field("name")} autoComplete="name" required />
              <Err k="name" />
            </div>
            <div className="field">
              <label htmlFor="f-instagram">
                Instagram handle <span className="opt">optional</span>
              </label>
              <input {...field("instagram")} placeholder="@yourhandle" autoCapitalize="off" />
            </div>
            <div className="field">
              <label htmlFor="f-email">Email ID</label>
              <input {...field("email")} type="email" autoComplete="email" inputMode="email" required />
              <Err k="email" />
            </div>
            <div className="field">
              <label htmlFor="f-phone">Contact number</label>
              <input {...field("phone")} type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" required />
              <Err k="phone" />
            </div>
            <div className="field field-full">
              <label htmlFor="f-service">Service required</label>
              <select {...field("service")} required>
                <option value="" disabled>
                  Choose a service
                </option>
                {serviceOptions.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <Err k="service" />
            </div>
            <div className="field field-full">
              <label htmlFor="f-message">Message or project brief</label>
              <textarea
                {...field("message")}
                rows={4}
                placeholder="What are you making, how many pieces, any deadline?"
                required
              />
              <Err k="message" />
            </div>
            <div className="field field-full">
              <label htmlFor="f-footage">
                Link to raw footage or reference <span className="opt">optional</span>
              </label>
              <input {...field("footage")} type="url" inputMode="url" placeholder="https://drive.google.com/…" />
              <Err k="footage" />
            </div>
            {/* Honeypot — hidden from people, tempting for bots. */}
            <div className="hp" aria-hidden="true">
              <label htmlFor="f-company">Company</label>
              <input id="f-company" name="company" tabIndex={-1} autoComplete="off" />
            </div>

            {status === "error" && (
              <p className="form-error field-full" role="alert">
                {serverMsg}{" "}
                <a href={waLink(brief)} target="_blank" rel="noopener">
                  Send on WhatsApp →
                </a>
              </p>
            )}

            <div className="form-actions field-full">
              <button className="btn btn-primary btn-lg" type="submit" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send enquiry"}
              </button>
              <a className="btn btn-ghost btn-lg" href={waLink(brief)} target="_blank" rel="noopener">
                <WhatsAppIcon size={18} /> Send via WhatsApp instead
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

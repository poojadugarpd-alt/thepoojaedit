import { NextResponse } from "next/server";
import { site } from "@/lib/site";
import { type Enquiry, validateEnquiry } from "@/lib/enquiry";

// Delivery order: Resend (email to Pooja) → Formspree → Google Sheets webhook (Apps Script).
// Configure at least one in .env. With none configured the endpoint returns 503 and the
// form tells the visitor to use WhatsApp instead, so no enquiry is silently lost.

function clean(v: unknown, max = 2000) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function viaResend(e: Enquiry, key: string) {
  const rows = Object.entries(e)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td>${esc(v)}</td></tr>`)
    .join("");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Studio Enquiries <onboarding@resend.dev>",
      to: [process.env.ENQUIRY_TO_EMAIL || site.email],
      reply_to: e.email,
      subject: `New enquiry: ${e.service} — ${e.name}`,
      html: `<h2>New enquiry</h2><table>${rows}</table>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function viaJson(url: string, e: Enquiry) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...e, _subject: `New enquiry: ${e.service}`, submittedAt: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Honeypot: bots fill every field.
  if (clean(body.company)) return NextResponse.json({ ok: true });

  const e: Enquiry = {
    name: clean(body.name, 120),
    instagram: clean(body.instagram, 60),
    email: clean(body.email, 200),
    phone: clean(body.phone, 20),
    service: clean(body.service, 40),
    message: clean(body.message, 4000),
    footage: clean(body.footage, 500),
  };
  const errors = validateEnquiry(e);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const tasks: Promise<void>[] = [];
  if (process.env.RESEND_API_KEY) tasks.push(viaResend(e, process.env.RESEND_API_KEY));
  if (process.env.FORMSPREE_ENDPOINT) tasks.push(viaJson(process.env.FORMSPREE_ENDPOINT, e));
  if (process.env.GOOGLE_SHEETS_WEBHOOK_URL) tasks.push(viaJson(process.env.GOOGLE_SHEETS_WEBHOOK_URL, e));

  if (!tasks.length) {
    console.warn("[enquiry] no delivery channel configured", e);
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const results = await Promise.allSettled(tasks);
  if (results.every((r) => r.status === "rejected")) {
    results.forEach((r) => r.status === "rejected" && console.error("[enquiry]", r.reason));
    return NextResponse.json({ ok: false, error: "delivery_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

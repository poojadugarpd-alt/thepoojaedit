import Image from "next/image";

import { formatPaiseINR } from "@/lib/money";

export function money(paise: number | null | undefined): string {
  return formatPaiseINR(paise ?? 0);
}

export function ts(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Semantic tone — maps to design/DESIGN.md's --ok/--wait/--stop tokens
// (globals.css). Status is always icon + label + colour, never colour alone
// (master §10, brief 4b).
const TONE_CLASS: Record<string, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-wait-bg text-wait",
  bad: "bg-stop-bg text-stop",
  muted: "bg-fill text-ink-soft",
};

// A small glyph per tone rather than an icon font/library — kept to three
// shapes so it reads at a glance without adding a dependency.
const TONE_GLYPH: Record<string, string> = {
  ok: "✓",
  warn: "●",
  bad: "✕",
  muted: "·",
};

const STATUS_TONE: Record<string, keyof typeof TONE_CLASS> = {
  CONFIRMED: "ok",
  PAID: "ok",
  DELIVERED: "ok",
  COMPLETED: "ok",
  COD_COLLECTED: "ok",
  PUBLISHED: "ok",
  RESTOCK: "ok",
  PENDING_PAYMENT: "warn",
  PENDING_CONFIRMATION: "warn",
  COD_PENDING: "warn",
  PROCESSING: "warn",
  SHIPPED: "warn",
  OUT_FOR_DELIVERY: "warn",
  AUTHORIZED: "warn",
  QUEUED: "warn",
  SENT: "warn",
  NEEDS_REVIEW: "bad",
  FAILED: "bad",
  CANCELLED: "bad",
  NDR: "bad",
  RTO_IN_TRANSIT: "bad",
  DISPUTED: "bad",
  REJECTED: "bad",
  DAMAGED_DISCARD: "bad",
};

// 56px, 4:5 — small enough to be free, big enough to recognize the item at a
// glance. A flat line-colour square stands in when a product has no primary
// image yet, rather than a broken/empty <img>. Shared by the product list
// and the collection product list (owner feedback, 2026-09-13).
export function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return <div aria-hidden="true" className="h-14 w-[45px] shrink-0 rounded bg-fill" />;
  }
  return (
    <div className="relative h-14 w-[45px] shrink-0 overflow-hidden rounded bg-fill">
      <Image src={url} alt={alt} fill sizes="45px" loading="lazy" className="object-cover" />
    </div>
  );
}

export function Pill({ value }: { value: string }) {
  const tone = STATUS_TONE[value] ?? "muted";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone]}`}
    >
      <span aria-hidden="true">{TONE_GLYPH[tone]}</span>
      {value.replaceAll("_", " ")}
    </span>
  );
}

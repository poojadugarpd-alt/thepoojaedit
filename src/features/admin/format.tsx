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

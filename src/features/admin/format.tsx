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

const TONE: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  bad: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  muted: "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60",
};

const STATUS_TONE: Record<string, keyof typeof TONE> = {
  CONFIRMED: "ok",
  PAID: "ok",
  DELIVERED: "ok",
  COMPLETED: "ok",
  COD_COLLECTED: "ok",
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
};

export function Pill({ value }: { value: string }) {
  const tone = STATUS_TONE[value] ?? "muted";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${TONE[tone]}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

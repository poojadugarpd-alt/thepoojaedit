import type { PublicAvailability } from "@/server/catalog/public-shape";

const LABEL: Record<PublicAvailability, string> = {
  IN_STOCK: "Available",
  OUT_OF_STOCK: "Out of stock",
  SOLD: "Sold",
};

const CLASS: Record<PublicAvailability, string> = {
  IN_STOCK:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  OUT_OF_STOCK: "bg-black/10 text-black/60 dark:bg-white/15 dark:text-white/60",
  SOLD: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
};

export function AvailabilityBadge({
  availability,
  className = "",
}: {
  availability: PublicAvailability;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CLASS[availability]} ${className}`}
    >
      {LABEL[availability]}
    </span>
  );
}

import type { PublicAvailability } from "@/server/catalog/public-shape";

const LABEL: Record<PublicAvailability, string> = {
  IN_STOCK: "Available",
  OUT_OF_STOCK: "Out of stock",
  SOLD: "Sold",
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
      className={`text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-ink-soft ${className}`}
    >
      {LABEL[availability]}
    </span>
  );
}

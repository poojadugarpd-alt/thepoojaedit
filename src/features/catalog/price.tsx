import { formatPaiseINR } from "@/lib/money";

/**
 * Advisory display price (master spec §4 — displayed prices are informational;
 * the server revalidates at checkout).
 */
export function Price({
  pricePaise,
  compareAtPaise,
  fromPrefix = false,
  className = "",
}: {
  pricePaise: number | null;
  compareAtPaise?: number | null;
  fromPrefix?: boolean;
  className?: string;
}) {
  if (pricePaise == null) {
    return <span className={className}>Price on request</span>;
  }
  const showCompare = compareAtPaise != null && compareAtPaise > pricePaise;
  return (
    <span className={className}>
      {fromPrefix && <span className="text-ink-soft">from </span>}
      <span className="text-ink-strong">{formatPaiseINR(pricePaise)}</span>
      {showCompare && (
        <span className="ml-2 text-ink-soft line-through">
          {formatPaiseINR(compareAtPaise)}
        </span>
      )}
    </span>
  );
}

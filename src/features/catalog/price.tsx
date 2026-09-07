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
      {fromPrefix && <span className="text-black/50 dark:text-white/50">from </span>}
      <span className="font-medium">{formatPaiseINR(pricePaise)}</span>
      {showCompare && (
        <span className="ml-2 text-black/45 line-through dark:text-white/45">
          {formatPaiseINR(compareAtPaise)}
        </span>
      )}
    </span>
  );
}

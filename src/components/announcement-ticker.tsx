import { liveSale } from "@/server/sale";
import { getCachedSaleSettings } from "@/server/sale/cached";

import { SaleCountdown } from "./sale-countdown";

const DEFAULT_LINE = "Considered clothing, new and second-life";

const SALE_TEXT = {
  ALL: { what: "Everything", href: "/" },
  LABEL: { what: "The Label", href: "/label" },
  CLOSET: { what: "The Closet", href: "/closet" },
} as const;

/**
 * Top-of-page announcement — an inset rounded sand bar, one calm line, centred.
 * Single statement, no marquee, no dismiss. While a timed sale runs it becomes
 * the sale line with a countdown (Admin → Discount codes → Sale).
 */
export async function AnnouncementTicker() {
  const sale = liveSale(await getCachedSaleSettings(), new Date());
  const t = sale ? SALE_TEXT[sale.scope] : null;
  return (
    <div className="u-bar">
      <p
        className={`px-4 py-2.5 text-center text-[0.6875rem] font-bold uppercase tracking-[0.09em] ${sale ? "text-brand-maroon" : "text-ink-soft"}`}
      >
        {sale && t ? (
          <SaleCountdown
            endsAt={sale.endsAt.toISOString()}
            text={`${t.what}: ${sale.percentBps / 100}% off`}
            href={t.href}
            fallback={DEFAULT_LINE}
          />
        ) : (
          DEFAULT_LINE
        )}
      </p>
    </div>
  );
}

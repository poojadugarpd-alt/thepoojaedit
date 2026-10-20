import type { CatalogType, PrismaClient } from "@/generated/prisma";

/**
 * Store-wide timed sale (e.g. "30% off the Closet until midnight"). One sale
 * at a time, kept in the `sale.current` setting and edited from Admin →
 * Discount codes. While it runs, matching products show the sale price with
 * the old price struck through, and checkout charges the sale price: the
 * quote applies it too, so the browser's price is never trusted. It ends by
 * itself at `endsAt`; nothing has to be switched back.
 */

export type SaleScope = "ALL" | "LABEL" | "CLOSET";

export interface SaleSettings {
  active: boolean;
  scope: SaleScope;
  /** Basis points off (3000 = 30%). */
  percentBps: number;
  /** ISO timestamp; the sale is over from this moment. */
  endsAt: string | null;
}

export interface LiveSale {
  scope: SaleScope;
  percentBps: number;
  endsAt: Date;
}

export const SALE_SETTING_KEY = "sale.current";

export const DEFAULT_SALE: SaleSettings = {
  active: false,
  scope: "CLOSET",
  percentBps: 0,
  endsAt: null,
};

export const MAX_SALE_BPS = 9000;

export function resolveSale(v: unknown): SaleSettings {
  const s = (v ?? {}) as Partial<SaleSettings>;
  const scope: SaleScope =
    s.scope === "ALL" || s.scope === "LABEL" || s.scope === "CLOSET"
      ? s.scope
      : DEFAULT_SALE.scope;
  const percentBps =
    typeof s.percentBps === "number" && Number.isInteger(s.percentBps)
      ? Math.min(Math.max(s.percentBps, 0), MAX_SALE_BPS)
      : 0;
  const endsAt =
    typeof s.endsAt === "string" && !Number.isNaN(Date.parse(s.endsAt))
      ? s.endsAt
      : null;
  return { active: s.active === true, scope, percentBps, endsAt };
}

/** The sale if it is switched on, takes something off and hasn't ended. */
export function liveSale(s: SaleSettings, now: Date): LiveSale | null {
  if (!s.active || s.percentBps <= 0 || !s.endsAt) return null;
  const endsAt = new Date(s.endsAt);
  if (endsAt <= now) return null;
  return { scope: s.scope, percentBps: s.percentBps, endsAt };
}

export function saleAppliesTo(sale: LiveSale | null, catalog: CatalogType): boolean {
  if (!sale) return false;
  if (sale.scope === "ALL") return true;
  if (sale.scope === "LABEL") return catalog === "THE_POOJA_EDIT";
  return catalog === "THRIFT";
}

/** The sale price, rounded to whole rupees so it reads cleanly (₹1,399 not ₹1,399.30). */
export function salePricePaise(pricePaise: number, percentBps: number): number {
  return Math.round((pricePaise * (10_000 - percentBps)) / 10_000 / 100) * 100;
}

/** What a variant of this catalog costs right now. */
export function effectivePricePaise(
  pricePaise: number,
  catalog: CatalogType,
  sale: LiveSale | null,
): number {
  return sale && saleAppliesTo(sale, catalog)
    ? salePricePaise(pricePaise, sale.percentBps)
    : pricePaise;
}

export async function getSaleSettings(db: PrismaClient): Promise<SaleSettings> {
  const row = await db.storeSettings.findUnique({ where: { key: SALE_SETTING_KEY } });
  return resolveSale(row?.value ?? null);
}

export async function getLiveSale(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<LiveSale | null> {
  return liveSale(await getSaleSettings(db), now);
}

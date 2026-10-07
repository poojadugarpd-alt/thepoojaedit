import type { CatalogType, DiscountCode } from "@/generated/prisma";

/**
 * Discount codes (D-140) — the pure part: validation of a code against a cart
 * and how its reduction is spread over the cart's lines. No database access,
 * so the money arithmetic is unit-tested on its own (`calc.test.ts`).
 *
 * Amounts are on the selling price, tax included (the shop's prices are
 * GST-inclusive). Each line's share goes to `computeOrderTax` as that line's
 * `discountPaise`, so GST is charged on the discounted price. Shipping is
 * never discounted. Codes also apply to items already on sale (owner,
 * 2026-10-07).
 */

export type DiscountCodeRow = Pick<
  DiscountCode,
  | "id"
  | "code"
  | "kind"
  | "percentBps"
  | "amountPaise"
  | "appliesTo"
  | "minSubtotalPaise"
  | "startsAt"
  | "endsAt"
  | "maxRedemptions"
  | "isActive"
>;

export interface DiscountLine {
  catalog: CatalogType;
  /** unitPricePaise × quantity */
  grossPaise: number;
}

export class DiscountCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscountCodeError";
  }
}

/** What the shopper typed → how codes are stored. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function appliesTo(code: DiscountCodeRow, catalog: CatalogType): boolean {
  if (code.appliesTo === "ALL") return true;
  if (code.appliesTo === "LABEL") return catalog === "THE_POOJA_EDIT";
  return catalog === "THRIFT";
}

const SCOPE_LABEL = { LABEL: "The Label", CLOSET: "Pooja's Closet" } as const;

/** Throws a shopper-facing `DiscountCodeError` if the code can't be used now. */
export function assertCodeUsable(
  code: DiscountCodeRow | null,
  opts: { now: Date; usedCount: number },
): asserts code is DiscountCodeRow {
  if (!code || !code.isActive) throw new DiscountCodeError("That code isn't valid.");
  if (code.startsAt && opts.now < code.startsAt) {
    throw new DiscountCodeError("That code isn't active yet.");
  }
  if (code.endsAt && opts.now >= code.endsAt) {
    throw new DiscountCodeError("That code has expired.");
  }
  if (code.maxRedemptions != null && opts.usedCount >= code.maxRedemptions) {
    throw new DiscountCodeError("That code has been fully used.");
  }
}

/**
 * The reduction per line (paise, tax included), summing exactly to the total.
 * Percent codes take that share of the eligible lines; fixed codes take their
 * amount, capped at the eligible lines' value. The total is spread over the
 * eligible lines in proportion to their value, with leftover paise going to
 * the lines with the largest remainders, so nothing is lost to rounding.
 */
export function allocateDiscount(
  code: DiscountCodeRow,
  lines: DiscountLine[],
): { perLinePaise: number[]; totalPaise: number } {
  const eligible = lines.map((l) => appliesTo(code, l.catalog));
  const eligibleGross = lines.reduce(
    (s, l, i) => s + (eligible[i] ? l.grossPaise : 0),
    0,
  );

  if (eligibleGross === 0) {
    throw new DiscountCodeError(
      code.appliesTo === "ALL"
        ? "That code doesn't apply to anything in your cart."
        : `That code only applies to ${SCOPE_LABEL[code.appliesTo]} items.`,
    );
  }
  if (code.minSubtotalPaise != null && eligibleGross < code.minSubtotalPaise) {
    const min = `₹${(code.minSubtotalPaise / 100).toLocaleString("en-IN")}`;
    throw new DiscountCodeError(
      code.appliesTo === "ALL"
        ? `That code needs an order of at least ${min}.`
        : `That code needs at least ${min} of ${SCOPE_LABEL[code.appliesTo]} items.`,
    );
  }

  let total: number;
  if (code.kind === "PERCENT") {
    const bps = Math.min(Math.max(code.percentBps ?? 0, 0), 10_000);
    total = Math.floor((eligibleGross * bps) / 10_000);
  } else {
    total = Math.min(Math.max(code.amountPaise ?? 0, 0), eligibleGross);
  }

  const perLinePaise = lines.map(() => 0);
  if (total === 0) return { perLinePaise, totalPaise: 0 };

  const shares = lines.map((l, i) => {
    if (!eligible[i]) return { i, base: 0, rem: -1 };
    const exact = (total * l.grossPaise) / eligibleGross;
    const base = Math.floor(exact);
    return { i, base, rem: exact - base };
  });
  for (const s of shares) perLinePaise[s.i] = s.base;
  let left = total - shares.reduce((s, x) => s + x.base, 0);
  const byRemainder = shares
    .filter((s) => s.rem >= 0)
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const s of byRemainder) {
    if (left === 0) break;
    if (perLinePaise[s.i] < lines[s.i].grossPaise) {
      perLinePaise[s.i] += 1;
      left -= 1;
    }
  }
  return { perLinePaise, totalPaise: total };
}

/**
 * Money primitive — everything monetary in this app is an integer number of
 * paise (1 rupee = 100 paise). No binary floating-point arithmetic is ever used
 * for currency (master spec §5, §6).
 *
 * Rounding rule (documented, single definition): **half-up on the absolute value**
 * (a.k.a. "round half away from zero"). Applied only at explicit boundaries such
 * as converting a rupee input to paise or splitting a total across lines. Interim
 * sums stay exact because they are integers.
 */

/** Branded integer-paise amount. Use the constructors below, not a bare cast. */
export type Paise = number & { readonly __brand: "Paise" };

export class MoneyError extends Error {}

function assertSafeInteger(n: number, what: string): void {
  if (!Number.isFinite(n) || !Number.isSafeInteger(n)) {
    throw new MoneyError(`${what} must be a safe integer, got ${n}`);
  }
}

/** Round half away from zero to an integer. */
export function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}

/** Assert (and brand) a value that is already in integer paise. */
export function paise(value: number): Paise {
  assertSafeInteger(value, "paise amount");
  return value as Paise;
}

export const ZERO: Paise = paise(0);

/**
 * Convert a rupee amount to paise without float drift.
 * Accepts a number (e.g. 1499.5) or a string (e.g. "1499.50", "1,499.5").
 * At most two fractional digits are allowed; a third+ digit is an error rather
 * than a silent round, so callers never lose precision by accident.
 */
export function rupeesToPaise(rupees: number | string): Paise {
  const raw = typeof rupees === "number" ? rupees.toString() : rupees.trim();
  const normalized = raw.replace(/,/g, "").replace(/\s/g, "");
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    throw new MoneyError(
      `Cannot parse rupee amount "${rupees}" (expected up to 2 decimal places)`,
    );
  }
  const [, sign, whole, frac = ""] = match;
  const fracPadded = (frac + "00").slice(0, 2);
  const total = Number(whole) * 100 + Number(fracPadded);
  return paise((sign ? -1 : 1) * total);
}

/** Rupees as a plain number, for display/formatting only — never for math. */
export function paiseToRupees(amount: Paise): number {
  return amount / 100;
}

export function addPaise(a: Paise, b: Paise): Paise {
  return paise(a + b);
}

export function subtractPaise(a: Paise, b: Paise): Paise {
  return paise(a - b);
}

export function sumPaise(amounts: readonly Paise[]): Paise {
  return paise(amounts.reduce<number>((acc, n) => acc + n, 0));
}

/** Multiply a unit price by an integer quantity. */
export function multiplyPaise(unit: Paise, quantity: number): Paise {
  assertSafeInteger(quantity, "quantity");
  if (quantity < 0) throw new MoneyError(`quantity must be >= 0, got ${quantity}`);
  return paise(unit * quantity);
}

/**
 * Apply a rate expressed in basis points (1 bp = 0.01%). Result is rounded with
 * the documented rule. Use for tax/discount components in later phases.
 */
export function applyBasisPoints(amount: Paise, basisPoints: number): Paise {
  assertSafeInteger(basisPoints, "basisPoints");
  return paise(roundHalfUp((amount * basisPoints) / 10_000));
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

/** Format paise as an INR string, e.g. 149950 -> "₹1,499.50". */
export function formatINR(amount: Paise): string {
  return inrFormatter.format(paiseToRupees(amount));
}

const inrWholeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/**
 * Display helper for a plain integer-paise value (no branding required).
 * Drops the decimals when the amount is a whole rupee — storefront style.
 */
export function formatPaiseINR(amountPaise: number): string {
  assertSafeInteger(amountPaise, "amount");
  return amountPaise % 100 === 0
    ? inrWholeFormatter.format(amountPaise / 100)
    : inrFormatter.format(amountPaise / 100);
}

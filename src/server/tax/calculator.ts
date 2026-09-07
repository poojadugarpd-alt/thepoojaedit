/**
 * GST calculator (master spec §6). Pure, integer-paise, deterministic.
 *
 * Rounding: half-away-from-zero (`roundHalfUp` from money.ts), applied only when
 * extracting a base from an inclusive price or applying a rate. Component
 * (CGST/SGST) rounding always sums back to the line tax exactly.
 *
 * Only the STANDARD treatment is implemented. `SECOND_HAND_MARGIN` is reserved
 * and throws — it must never be inferred (master §6).
 */
import { roundHalfUp } from "@/lib/money";

export type PricingMode = "INCLUSIVE" | "EXCLUSIVE";
export type TaxTreatment = "STANDARD" | "SECOND_HAND_MARGIN";

export interface TaxRuleInput {
  treatment: TaxTreatment;
  pricingMode: PricingMode;
  totalRateBps: number; // 500 = 5%
}

export interface Split {
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

export interface LineTaxInput {
  unitPricePaise: number;
  quantity: number;
  /** Reduction applied to the line before tax. Default 0 (no promo engine yet). */
  discountPaise?: number;
  rule: TaxRuleInput;
  /** true → IGST; false → CGST + SGST (supplier state === place of supply). */
  interState: boolean;
}

export interface LineTaxResult {
  /** Pre-tax merchandise value at list price (before the line discount). */
  listValuePaise: number;
  /** The discount, expressed as a reduction of the taxable base. */
  discountPaise: number;
  /** Post-discount, pre-tax value. */
  taxableValuePaise: number;
  taxPaise: number;
  split: Split;
  rateBps: number;
  pricingMode: PricingMode;
  /** What the customer pays for this line = taxableValue + tax. */
  lineTotalPaise: number;
}

export class TaxError extends Error {}

function extractBase(grossPaise: number, rateBps: number): number {
  // taxable = gross * 10000 / (10000 + rateBps)   (does not add tax twice)
  return roundHalfUp((grossPaise * 10_000) / (10_000 + rateBps));
}

function splitTax(taxPaise: number, interState: boolean): Split {
  if (interState) return { cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise };
  const cgstPaise = Math.trunc(taxPaise / 2);
  return { cgstPaise, sgstPaise: taxPaise - cgstPaise, igstPaise: 0 };
}

export function computeLineTax(input: LineTaxInput): LineTaxResult {
  if (input.rule.treatment !== "STANDARD") {
    throw new TaxError(
      `Tax treatment ${input.rule.treatment} is not enabled (master §6).`,
    );
  }
  if (input.quantity <= 0 || !Number.isInteger(input.quantity)) {
    throw new TaxError(`quantity must be a positive integer, got ${input.quantity}`);
  }
  if (input.unitPricePaise < 0) throw new TaxError("unitPricePaise must be >= 0");

  const discount = input.discountPaise ?? 0;
  if (discount < 0) throw new TaxError("discountPaise must be >= 0");
  const rateBps = input.rule.totalRateBps;
  const listGross = input.unitPricePaise * input.quantity;
  if (discount > listGross) throw new TaxError("discount exceeds the line value");

  let listValuePaise: number;
  let taxableValuePaise: number;
  let taxPaise: number;

  if (input.rule.pricingMode === "INCLUSIVE") {
    listValuePaise = extractBase(listGross, rateBps);
    const effectiveGross = listGross - discount;
    taxableValuePaise = extractBase(effectiveGross, rateBps);
    taxPaise = effectiveGross - taxableValuePaise;
  } else {
    listValuePaise = listGross;
    taxableValuePaise = listGross - discount;
    taxPaise = roundHalfUp((taxableValuePaise * rateBps) / 10_000);
  }

  return {
    listValuePaise,
    discountPaise: listValuePaise - taxableValuePaise,
    taxableValuePaise,
    taxPaise,
    split: splitTax(taxPaise, input.interState),
    rateBps,
    pricingMode: input.rule.pricingMode,
    lineTotalPaise: taxableValuePaise + taxPaise,
  };
}

export interface OrderTaxInput {
  lines: LineTaxInput[];
  shippingPaise?: number;
  codFeePaise?: number;
  /** Optional rule for taxing shipping (master §6: shipping/fee treatment). */
  shippingRule?: TaxRuleInput & { interState: boolean };
}

export interface OrderTaxResult {
  lines: LineTaxResult[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  codFeePaise: number;
  taxPaise: number;
  totalPaise: number;
  /** Order-level tax component split (line splits + shipping split). */
  split: Split;
}

export function computeOrderTax(input: OrderTaxInput): OrderTaxResult {
  const lines = input.lines.map(computeLineTax);
  const shippingPaise = input.shippingPaise ?? 0;
  const codFeePaise = input.codFeePaise ?? 0;

  const subtotalPaise = lines.reduce((s, l) => s + l.listValuePaise, 0);
  const discountPaise = lines.reduce((s, l) => s + l.discountPaise, 0);
  let taxPaise = lines.reduce((s, l) => s + l.taxPaise, 0);
  const split: Split = lines.reduce(
    (acc, l) => ({
      cgstPaise: acc.cgstPaise + l.split.cgstPaise,
      sgstPaise: acc.sgstPaise + l.split.sgstPaise,
      igstPaise: acc.igstPaise + l.split.igstPaise,
    }),
    { cgstPaise: 0, sgstPaise: 0, igstPaise: 0 },
  );

  if (input.shippingRule && shippingPaise > 0) {
    const s = computeLineTax({
      unitPricePaise: shippingPaise,
      quantity: 1,
      rule: input.shippingRule,
      interState: input.shippingRule.interState,
    });
    taxPaise += s.taxPaise;
    split.cgstPaise += s.split.cgstPaise;
    split.sgstPaise += s.split.sgstPaise;
    split.igstPaise += s.split.igstPaise;
  }

  const totalPaise =
    subtotalPaise - discountPaise + shippingPaise + codFeePaise + taxPaise;

  return {
    lines,
    subtotalPaise,
    discountPaise,
    shippingPaise,
    codFeePaise,
    taxPaise,
    totalPaise,
    split,
  };
}

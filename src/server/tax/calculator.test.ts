import { describe, expect, it } from "vitest";

import { computeLineTax, computeOrderTax, TaxError } from "./calculator";

const STD_INCL = {
  treatment: "STANDARD",
  pricingMode: "INCLUSIVE",
  totalRateBps: 500,
} as const;
const STD_EXCL = {
  treatment: "STANDARD",
  pricingMode: "EXCLUSIVE",
  totalRateBps: 1800,
} as const;

describe("inclusive extraction (master §6 — no double tax)", () => {
  it("extracts the base from a tax-inclusive price", () => {
    // ₹1,499.00 gross @ 5% inclusive
    const r = computeLineTax({
      unitPricePaise: 149900,
      quantity: 1,
      rule: STD_INCL,
      interState: false,
    });
    expect(r.taxableValuePaise).toBe(142762); // round(149900*10000/10500)
    expect(r.taxPaise).toBe(7138); // 149900 - 142762
    expect(r.taxableValuePaise + r.taxPaise).toBe(149900); // never adds tax twice
    expect(r.lineTotalPaise).toBe(149900);
  });

  it("splits intra-state tax into CGST + SGST that sum exactly", () => {
    const r = computeLineTax({
      unitPricePaise: 89900,
      quantity: 1,
      rule: STD_INCL,
      interState: false,
    });
    expect(r.split.cgstPaise + r.split.sgstPaise).toBe(r.taxPaise);
    expect(r.split.igstPaise).toBe(0);
    // odd paisa goes to SGST
    expect(r.split.sgstPaise - r.split.cgstPaise).toBeLessThanOrEqual(1);
  });

  it("uses IGST for an inter-state sale", () => {
    const r = computeLineTax({
      unitPricePaise: 100000,
      quantity: 2,
      rule: STD_INCL,
      interState: true,
    });
    expect(r.split.igstPaise).toBe(r.taxPaise);
    expect(r.split.cgstPaise).toBe(0);
    expect(r.split.sgstPaise).toBe(0);
  });
});

describe("exclusive", () => {
  it("adds tax on top of the taxable value", () => {
    const r = computeLineTax({
      unitPricePaise: 100000,
      quantity: 1,
      rule: STD_EXCL,
      interState: false,
    });
    expect(r.taxableValuePaise).toBe(100000);
    expect(r.taxPaise).toBe(18000); // 18%
    expect(r.lineTotalPaise).toBe(118000);
  });
});

describe("discounts reduce the base", () => {
  it("inclusive: discount reduces both gross and taxable, identity holds", () => {
    const r = computeLineTax({
      unitPricePaise: 200000,
      quantity: 1,
      discountPaise: 20000,
      rule: STD_INCL,
      interState: false,
    });
    // effective gross 180000 @5% inclusive
    expect(r.taxableValuePaise).toBe(171429); // round(180000*10000/10500)
    expect(r.taxPaise).toBe(8571);
    expect(r.lineTotalPaise).toBe(180000);
    expect(r.listValuePaise - r.discountPaise).toBe(r.taxableValuePaise);
  });
});

describe("guards", () => {
  it("rejects a disabled treatment, non-positive qty, negative price, over-discount", () => {
    expect(() =>
      computeLineTax({
        unitPricePaise: 100,
        quantity: 1,
        rule: { ...STD_INCL, treatment: "SECOND_HAND_MARGIN" },
        interState: false,
      }),
    ).toThrow(TaxError);
    expect(() =>
      computeLineTax({
        unitPricePaise: 100,
        quantity: 0,
        rule: STD_INCL,
        interState: false,
      }),
    ).toThrow(/positive integer/);
    expect(() =>
      computeLineTax({
        unitPricePaise: -1,
        quantity: 1,
        rule: STD_INCL,
        interState: false,
      }),
    ).toThrow(/>= 0/);
    expect(() =>
      computeLineTax({
        unitPricePaise: 100,
        quantity: 1,
        discountPaise: 200,
        rule: STD_INCL,
        interState: false,
      }),
    ).toThrow(/exceeds/);
  });
});

describe("order totals contract (master §6)", () => {
  it("total = subtotal - discount + shipping + codFee + tax, in paise", () => {
    const o = computeOrderTax({
      lines: [
        { unitPricePaise: 149900, quantity: 1, rule: STD_INCL, interState: false },
        { unitPricePaise: 89900, quantity: 2, rule: STD_INCL, interState: false },
      ],
      shippingPaise: 9900,
      codFeePaise: 3000,
    });
    expect(o.totalPaise).toBe(
      o.subtotalPaise - o.discountPaise + o.shippingPaise + o.codFeePaise + o.taxPaise,
    );
    // reconciles line-by-line too
    const lineSum = o.lines.reduce((s, l) => s + l.lineTotalPaise, 0);
    expect(o.totalPaise).toBe(lineSum + o.shippingPaise + o.codFeePaise);
    expect(o.split.cgstPaise + o.split.sgstPaise + o.split.igstPaise).toBe(o.taxPaise);
  });

  it("optionally taxes shipping when a shipping rule is given", () => {
    const withShipTax = computeOrderTax({
      lines: [
        { unitPricePaise: 100000, quantity: 1, rule: STD_EXCL, interState: false },
      ],
      shippingPaise: 10000,
      shippingRule: {
        treatment: "STANDARD",
        pricingMode: "EXCLUSIVE",
        totalRateBps: 1800,
        interState: false,
      },
    });
    // 18000 (goods) + 1800 (shipping) = 19800
    expect(withShipTax.taxPaise).toBe(19800);
    expect(withShipTax.totalPaise).toBe(100000 + 10000 + 19800);
  });
});

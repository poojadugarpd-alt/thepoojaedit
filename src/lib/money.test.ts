import { describe, expect, it } from "vitest";

import {
  MoneyError,
  addPaise,
  applyBasisPoints,
  formatINR,
  multiplyPaise,
  paise,
  roundHalfUp,
  rupeesToPaise,
  subtractPaise,
  sumPaise,
} from "./money";

describe("rupeesToPaise", () => {
  it("converts whole and fractional rupees without float drift", () => {
    expect(rupeesToPaise(1499)).toBe(149900);
    expect(rupeesToPaise("1499.50")).toBe(149950);
    expect(rupeesToPaise("0.1")).toBe(10);
    expect(rupeesToPaise("1,23,456.7")).toBe(12345670);
  });

  it("classically-lossy values stay exact", () => {
    // 0.1 + 0.2 in float is 0.30000000000000004; here it is just integers.
    expect(addPaise(rupeesToPaise("0.1"), rupeesToPaise("0.2"))).toBe(30);
  });

  it("rejects more than two decimal places instead of silently rounding", () => {
    expect(() => rupeesToPaise("10.005")).toThrow(MoneyError);
  });

  it("rejects non-numeric input", () => {
    expect(() => rupeesToPaise("free")).toThrow(MoneyError);
  });

  it("handles negatives", () => {
    expect(rupeesToPaise("-50.25")).toBe(-5025);
  });
});

describe("paise guard", () => {
  it("rejects non-integers", () => {
    expect(() => paise(10.5)).toThrow(MoneyError);
  });
});

describe("arithmetic", () => {
  it("adds, subtracts, sums and multiplies", () => {
    expect(addPaise(paise(100), paise(250))).toBe(350);
    expect(subtractPaise(paise(500), paise(150))).toBe(350);
    expect(sumPaise([paise(10), paise(20), paise(30)])).toBe(60);
    expect(multiplyPaise(paise(1999), 3)).toBe(5997);
  });

  it("rejects negative quantity", () => {
    expect(() => multiplyPaise(paise(100), -1)).toThrow(MoneyError);
  });
});

describe("roundHalfUp", () => {
  it("rounds half away from zero", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(2.4)).toBe(2);
  });
});

describe("applyBasisPoints", () => {
  it("applies an 18% (1800 bp) rate with documented rounding", () => {
    expect(applyBasisPoints(paise(149900), 1800)).toBe(26982);
    expect(applyBasisPoints(paise(101), 1800)).toBe(18); // 18.18 -> 18
  });
});

describe("formatINR", () => {
  it("formats paise as an INR string", () => {
    // ICU may or may not insert a space after the symbol; tolerate both.
    expect(formatINR(paise(149950))).toMatch(/^₹\s?1,499\.50$/);
  });
});

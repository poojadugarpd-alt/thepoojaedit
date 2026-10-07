import { describe, expect, it } from "vitest";

import {
  allocateDiscount,
  assertCodeUsable,
  normalizeCode,
  type DiscountCodeRow,
} from "./calc";

const code = (over: Partial<DiscountCodeRow> = {}): DiscountCodeRow => ({
  id: "c1",
  code: "SAVE10",
  kind: "PERCENT",
  percentBps: 1000,
  amountPaise: null,
  appliesTo: "ALL",
  minSubtotalPaise: null,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  isActive: true,
  ...over,
});

const label = (g: number) => ({ catalog: "THE_POOJA_EDIT" as const, grossPaise: g });
const closet = (g: number) => ({ catalog: "THRIFT" as const, grossPaise: g });

describe("allocateDiscount (D-140)", () => {
  it("percent: takes the share of the cart and splits it exactly", () => {
    const r = allocateDiscount(code(), [label(149_900), label(99_900), closet(33_333)]);
    expect(r.totalPaise).toBe(28_313); // floor(283_133 × 10%)
    expect(r.perLinePaise.reduce((a, b) => a + b, 0)).toBe(r.totalPaise);
  });

  it("fixed: capped at the eligible value", () => {
    const r = allocateDiscount(code({ kind: "FIXED", amountPaise: 50_000 }), [
      label(30_000),
    ]);
    expect(r).toEqual({ perLinePaise: [30_000], totalPaise: 30_000 });
  });

  it("scope: only touches matching lines", () => {
    const r = allocateDiscount(code({ appliesTo: "CLOSET" }), [
      label(100_000),
      closet(50_000),
    ]);
    expect(r.perLinePaise).toEqual([0, 5_000]);
  });

  it("scope with nothing matching names the catalogue", () => {
    expect(() =>
      allocateDiscount(code({ appliesTo: "LABEL" }), [closet(50_000)]),
    ).toThrow("only applies to The Label items");
  });

  it("minimum is checked against the eligible items", () => {
    const c = code({ appliesTo: "LABEL", minSubtotalPaise: 200_000 });
    expect(() => allocateDiscount(c, [label(150_000), closet(500_000)])).toThrow(
      "at least ₹2,000 of The Label items",
    );
  });

  it("rounding remainders go to the largest fractions and sum exactly", () => {
    const r = allocateDiscount(code({ kind: "FIXED", amountPaise: 100 }), [
      label(1),
      label(1),
      label(1),
    ]);
    expect(r.perLinePaise.reduce((a, b) => a + b, 0)).toBe(3);
    expect(r.perLinePaise.every((p) => p <= 1)).toBe(true);
  });
});

describe("assertCodeUsable", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  it("rejects inactive, early, expired and used-up codes", () => {
    expect(() => assertCodeUsable(null, { now, usedCount: 0 })).toThrow("isn't valid");
    expect(() =>
      assertCodeUsable(code({ isActive: false }), { now, usedCount: 0 }),
    ).toThrow("isn't valid");
    expect(() =>
      assertCodeUsable(code({ startsAt: new Date("2026-10-08") }), {
        now,
        usedCount: 0,
      }),
    ).toThrow("isn't active yet");
    expect(() =>
      assertCodeUsable(code({ endsAt: new Date("2026-10-07T11:00:00Z") }), {
        now,
        usedCount: 0,
      }),
    ).toThrow("expired");
    expect(() =>
      assertCodeUsable(code({ maxRedemptions: 2 }), { now, usedCount: 2 }),
    ).toThrow("fully used");
    expect(() =>
      assertCodeUsable(code({ maxRedemptions: 2 }), { now, usedCount: 1 }),
    ).not.toThrow();
  });

  it("normalizes what the shopper typed", () => {
    expect(normalizeCode("  diwali 20 ")).toBe("DIWALI20");
  });
});

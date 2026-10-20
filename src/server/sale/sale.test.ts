import { describe, expect, it } from "vitest";

import {
  effectivePricePaise,
  liveSale,
  resolveSale,
  saleAppliesTo,
  salePricePaise,
} from "./index";

const NOW = new Date("2026-10-20T08:00:00Z"); // 1:30 pm IST
const MIDNIGHT_IST = "2026-10-20T18:30:00.000Z";

describe("timed sale", () => {
  it("is off when nothing is saved", () => {
    expect(liveSale(resolveSale(null), NOW)).toBeNull();
  });

  it("runs until its end time, then stops by itself", () => {
    const s = resolveSale({
      active: true,
      scope: "CLOSET",
      percentBps: 3000,
      endsAt: MIDNIGHT_IST,
    });
    expect(liveSale(s, NOW)?.percentBps).toBe(3000);
    expect(liveSale(s, new Date(MIDNIGHT_IST))).toBeNull();
  });

  it("is off when switched off or with nothing off", () => {
    expect(
      liveSale(
        resolveSale({ active: false, percentBps: 3000, endsAt: MIDNIGHT_IST }),
        NOW,
      ),
    ).toBeNull();
    expect(
      liveSale(resolveSale({ active: true, percentBps: 0, endsAt: MIDNIGHT_IST }), NOW),
    ).toBeNull();
  });

  it("caps the discount and ignores a bad scope", () => {
    const s = resolveSale({ active: true, scope: "SHOES", percentBps: 12_000 });
    expect(s.scope).toBe("CLOSET");
    expect(s.percentBps).toBe(9000);
  });

  it("applies only to its catalog", () => {
    const closet = liveSale(
      resolveSale({
        active: true,
        scope: "CLOSET",
        percentBps: 3000,
        endsAt: MIDNIGHT_IST,
      }),
      NOW,
    );
    expect(saleAppliesTo(closet, "THRIFT")).toBe(true);
    expect(saleAppliesTo(closet, "THE_POOJA_EDIT")).toBe(false);
    expect(effectivePricePaise(199_900, "THE_POOJA_EDIT", closet)).toBe(199_900);
    expect(effectivePricePaise(199_900, "THRIFT", null)).toBe(199_900);
  });

  it("takes 30% off and rounds to whole rupees", () => {
    expect(salePricePaise(200_000, 3000)).toBe(140_000); // ₹2,000 → ₹1,400
    expect(salePricePaise(199_900, 3000)).toBe(139_900); // ₹1,999 → ₹1,399.30 → ₹1,399
    expect(salePricePaise(150_000, 3000) % 100).toBe(0);
  });
});

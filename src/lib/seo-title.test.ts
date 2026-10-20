import { describe, expect, it } from "vitest";

import { closetSeoTitle, withBrandIfFits } from "./seo-title";

describe("withBrandIfFits", () => {
  it("keeps the brand suffix (template) when the full title fits in 60", () => {
    expect(withBrandIfFits("Personal styling")).toBe("Personal styling");
  });

  it("drops the suffix when it would push the title past 60", () => {
    const long = "Personal Shopping & Styling in Delhi NCR | Pooja Dugar";
    expect(withBrandIfFits(long)).toEqual({ absolute: long });
  });
});

describe("closetSeoTitle", () => {
  it("adds the size and Pre-loved", () => {
    expect(closetSeoTitle("Zara Top - Black", "S")).toBe("Zara Top - Black, Size S · Pre-loved");
  });

  it("leaves the size out when there is none", () => {
    expect(closetSeoTitle("Silk Scarf", null)).toBe("Silk Scarf · Pre-loved");
  });

  it("drops the brand suffix for a long piece name", () => {
    expect(closetSeoTitle("Boohoo Floral Corset Top - Pink", "M")).toEqual({
      absolute: "Boohoo Floral Corset Top - Pink, Size M · Pre-loved",
    });
  });
});

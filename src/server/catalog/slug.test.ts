import { describe, expect, it } from "vitest";

import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases, hyphenates, strips punctuation", () => {
    expect(slugify("Marigold Cotton Kurta")).toBe("marigold-cotton-kurta");
    expect(slugify("Silk Scarf — Paisley!")).toBe("silk-scarf-paisley");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Élan")).toBe("cafe-elan");
  });

  it("collapses repeated separators and trims leading/trailing hyphens", () => {
    expect(slugify("  --Kurti   14--  ")).toBe("kurti-14");
  });

  it("never returns an empty string", () => {
    expect(slugify("!!!")).toBe("product");
    expect(slugify("")).toBe("product");
  });
});

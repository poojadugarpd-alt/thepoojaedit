import { describe, expect, it } from "vitest";

import { MAX_ORDER_QTY, variantMaxOrderQty } from "./public-shape";

describe("variantMaxOrderQty", () => {
  it("caps at real stock when stock is below the order ceiling", () => {
    // The reported bug: an 8-in-stock variant let the storefront's quantity
    // picker offer 9 (the old hardcoded flat cap), one more than existed.
    expect(variantMaxOrderQty({ isActive: true, onHandQty: 8, reservedQty: 0 })).toBe(8);
  });

  it("caps at MAX_ORDER_QTY when stock is generous", () => {
    expect(
      variantMaxOrderQty({ isActive: true, onHandQty: 500, reservedQty: 0 }),
    ).toBe(MAX_ORDER_QTY);
  });

  it("subtracts reserved stock", () => {
    expect(variantMaxOrderQty({ isActive: true, onHandQty: 8, reservedQty: 3 })).toBe(5);
  });

  it("never goes negative when reserved exceeds on-hand", () => {
    expect(variantMaxOrderQty({ isActive: true, onHandQty: 2, reservedQty: 5 })).toBe(0);
  });

  it("is 0 for an inactive variant regardless of stock", () => {
    expect(variantMaxOrderQty({ isActive: false, onHandQty: 50, reservedQty: 0 })).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import {
  deriveAvailability,
  MAX_ORDER_QTY,
  variantMaxOrderQty,
  variantOnHold,
} from "./public-shape";

describe("variantMaxOrderQty", () => {
  it("caps at real stock when stock is below the order ceiling", () => {
    // The reported bug: an 8-in-stock variant let the storefront's quantity
    // picker offer 9 (the old hardcoded flat cap), one more than existed.
    expect(variantMaxOrderQty({ isActive: true, onHandQty: 8, reservedQty: 0 })).toBe(
      8,
    );
  });

  it("caps at MAX_ORDER_QTY when stock is generous", () => {
    expect(variantMaxOrderQty({ isActive: true, onHandQty: 500, reservedQty: 0 })).toBe(
      MAX_ORDER_QTY,
    );
  });

  it("subtracts reserved stock", () => {
    expect(variantMaxOrderQty({ isActive: true, onHandQty: 8, reservedQty: 3 })).toBe(
      5,
    );
  });

  it("never goes negative when reserved exceeds on-hand", () => {
    expect(variantMaxOrderQty({ isActive: true, onHandQty: 2, reservedQty: 5 })).toBe(
      0,
    );
  });

  it("is 0 for an inactive variant regardless of stock", () => {
    expect(variantMaxOrderQty({ isActive: false, onHandQty: 50, reservedQty: 0 })).toBe(
      0,
    );
  });
});

describe("deriveAvailability with the Sold out switch (D-138)", () => {
  const inStock = [{ isActive: true, onHandQty: 4, reservedQty: 0 }];

  it("is IN_STOCK from stock when the switch is off", () => {
    expect(deriveAvailability("THE_POOJA_EDIT", false, inStock)).toBe("IN_STOCK");
  });

  it("overrides real stock: Label and multi-piece Closet read OUT_OF_STOCK", () => {
    expect(deriveAvailability("THE_POOJA_EDIT", false, inStock, true)).toBe(
      "OUT_OF_STOCK",
    );
    expect(deriveAvailability("THRIFT", false, inStock, true)).toBe("OUT_OF_STOCK");
  });

  it("a one-of-one Closet piece reads SOLD", () => {
    expect(deriveAvailability("THRIFT", true, inStock, true)).toBe("SOLD");
  });
});

describe("deriveAvailability while an unpaid checkout holds the stock (D-150)", () => {
  const held = [{ isActive: true, onHandQty: 1, reservedQty: 1 }];

  it("reads ON_HOLD, not SOLD, for a held one-of-one piece", () => {
    expect(deriveAvailability("THRIFT", true, held)).toBe("ON_HOLD");
    expect(variantOnHold(held[0])).toBe(true);
  });

  it("stays IN_STOCK while any size is still free", () => {
    expect(
      deriveAvailability("THE_POOJA_EDIT", false, [
        ...held,
        { isActive: true, onHandQty: 3, reservedQty: 0 },
      ]),
    ).toBe("IN_STOCK");
  });

  it("is not on hold when nothing is in stock, or when the owner marked it sold out", () => {
    const gone = [{ isActive: true, onHandQty: 0, reservedQty: 0 }];
    expect(deriveAvailability("THRIFT", true, gone)).toBe("SOLD");
    expect(variantOnHold(gone[0])).toBe(false);
    expect(deriveAvailability("THE_POOJA_EDIT", false, held, true)).toBe(
      "OUT_OF_STOCK",
    );
  });
});

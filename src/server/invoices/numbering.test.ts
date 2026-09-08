import { describe, expect, it } from "vitest";

import { financialYearFor, formatInvoiceNumber } from "./numbering";

describe("financialYearFor (India, Apr–Mar)", () => {
  it("March is the previous FY", () => {
    expect(financialYearFor(new Date("2026-03-31T18:00:00Z"))).toBe("2025-26");
    expect(financialYearFor(new Date("2026-01-15T00:00:00Z"))).toBe("2025-26");
  });
  it("April 1 starts the new FY", () => {
    expect(financialYearFor(new Date("2026-04-01T00:00:00Z"))).toBe("2026-27");
    expect(financialYearFor(new Date("2026-12-31T23:59:59Z"))).toBe("2026-27");
  });
  it("year rollover formats the second year as 2 digits", () => {
    expect(financialYearFor(new Date("2099-05-01T00:00:00Z"))).toBe("2099-00");
  });
});

describe("formatInvoiceNumber", () => {
  it("zero-pads to 6 digits", () => {
    expect(formatInvoiceNumber("2026-27", "A", 42)).toBe("PE/2026-27/A/000042");
  });
});

import { describe, expect, it } from "vitest";

import { courierTrackingUrl } from "./couriers";

describe("courierTrackingUrl", () => {
  it("builds Delhivery's public tracking page, any capitalisation", () => {
    expect(courierTrackingUrl("Delhivery", "1234567890123")).toBe(
      "https://www.delhivery.com/track-v2/package/1234567890123",
    );
    expect(courierTrackingUrl(" delhivery ", " 99 ")).toBe(
      "https://www.delhivery.com/track-v2/package/99",
    );
  });

  it("returns null for couriers it doesn't know", () => {
    expect(courierTrackingUrl("DTDC", "D123")).toBeNull();
  });
});

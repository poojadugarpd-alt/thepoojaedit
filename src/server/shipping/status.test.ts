import { describe, expect, it } from "vitest";

import {
  eventFingerprint,
  isShipmentOpen,
  normalizeShadowfaxStatus,
  SHIPMENT_TERMINAL,
  shouldApplyTransition,
} from "./status";

describe("normalizeShadowfaxStatus", () => {
  it("maps known raw statuses, case/spacing insensitive", () => {
    expect(normalizeShadowfaxStatus("PICKED_UP")).toBe("SHIPPED");
    expect(normalizeShadowfaxStatus("out for delivery")).toBe("OUT_FOR_DELIVERY");
    expect(normalizeShadowfaxStatus(" Delivered ")).toBe("DELIVERED");
    expect(normalizeShadowfaxStatus("UNDELIVERED")).toBe("NDR");
    expect(normalizeShadowfaxStatus("RTO_INITIATED")).toBe("RTO_IN_TRANSIT");
    expect(normalizeShadowfaxStatus("RTO_DELIVERED")).toBe("RTO_RECEIVED");
  });

  it("returns null for an unknown status rather than guessing", () => {
    expect(normalizeShadowfaxStatus("SOMETHING_NEW")).toBeNull();
  });
});

describe("terminal / open", () => {
  it("delivered, rto-received and cancelled are terminal", () => {
    expect([...SHIPMENT_TERMINAL].sort()).toEqual(
      ["CANCELLED", "DELIVERED", "RTO_RECEIVED"].sort(),
    );
    expect(isShipmentOpen("SHIPPED")).toBe(true);
    expect(isShipmentOpen("DELIVERED")).toBe(false);
  });
});

describe("shouldApplyTransition", () => {
  const base = { current: "SHIPPED" as const, latestAppliedAt: new Date("2026-01-02T10:00:00Z") };

  it("applies a legal forward step with a newer timestamp", () => {
    expect(
      shouldApplyTransition({
        ...base,
        next: "OUT_FOR_DELIVERY",
        occurredAt: new Date("2026-01-02T12:00:00Z"),
      }),
    ).toBe(true);
  });

  it("does not regress on an older (out-of-order) event", () => {
    expect(
      shouldApplyTransition({
        ...base,
        current: "OUT_FOR_DELIVERY",
        next: "SHIPPED",
        occurredAt: new Date("2026-01-02T09:00:00Z"),
      }),
    ).toBe(false);
  });

  it("rejects an illegal transition (DELIVERED → SHIPPED)", () => {
    expect(
      shouldApplyTransition({
        current: "DELIVERED",
        next: "SHIPPED",
        occurredAt: new Date("2026-01-03T00:00:00Z"),
        latestAppliedAt: new Date("2026-01-02T00:00:00Z"),
      }),
    ).toBe(false);
  });

  it("allows NDR → OUT_FOR_DELIVERY (a re-attempt)", () => {
    expect(
      shouldApplyTransition({
        current: "NDR",
        next: "OUT_FOR_DELIVERY",
        occurredAt: new Date("2026-01-03T00:00:00Z"),
        latestAppliedAt: new Date("2026-01-02T00:00:00Z"),
      }),
    ).toBe(true);
  });

  it("null (unknown) next status never applies", () => {
    expect(
      shouldApplyTransition({
        current: "SHIPPED",
        next: null,
        occurredAt: new Date(),
        latestAppliedAt: null,
      }),
    ).toBe(false);
  });
});

describe("eventFingerprint", () => {
  it("is deterministic for the same shipment + status + time", () => {
    const at = new Date("2026-01-02T12:00:00Z");
    const a = eventFingerprint({ shipmentId: "s1", statusRaw: "IN_TRANSIT", occurredAt: at });
    const b = eventFingerprint({ shipmentId: "s1", statusRaw: "in_transit", occurredAt: at });
    expect(a).toBe(b);
  });

  it("differs by status and by time", () => {
    const at = new Date("2026-01-02T12:00:00Z");
    const later = new Date("2026-01-02T13:00:00Z");
    expect(
      eventFingerprint({ shipmentId: "s1", statusRaw: "IN_TRANSIT", occurredAt: at }),
    ).not.toBe(
      eventFingerprint({ shipmentId: "s1", statusRaw: "OUT_FOR_DELIVERY", occurredAt: at }),
    );
    expect(
      eventFingerprint({ shipmentId: "s1", statusRaw: "IN_TRANSIT", occurredAt: at }),
    ).not.toBe(
      eventFingerprint({ shipmentId: "s1", statusRaw: "IN_TRANSIT", occurredAt: later }),
    );
  });

  it("prefers a provider event id when present", () => {
    expect(
      eventFingerprint({
        shipmentId: "s1",
        statusRaw: "X",
        occurredAt: null,
        externalEventId: "evt_9",
      }),
    ).toBe("id:evt_9");
  });
});

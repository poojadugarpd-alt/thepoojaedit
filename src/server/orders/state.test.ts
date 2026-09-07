import { describe, expect, it } from "vitest";

import {
  ORDER_TRANSITIONS,
  FULFILLMENT_TRANSITIONS,
  IllegalTransitionError,
  assertTransition,
  canTransition,
  deriveAggregatePaymentStatus,
} from "./state";

describe("order transitions", () => {
  it("allows placed → confirmed → completed, blocks confirmed → placed", () => {
    expect(canTransition(ORDER_TRANSITIONS, "PENDING_PAYMENT", "CONFIRMED")).toBe(true);
    expect(canTransition(ORDER_TRANSITIONS, "CONFIRMED", "COMPLETED")).toBe(true);
    expect(canTransition(ORDER_TRANSITIONS, "CONFIRMED", "PENDING_PAYMENT")).toBe(
      false,
    );
    expect(canTransition(ORDER_TRANSITIONS, "CANCELLED", "CONFIRMED")).toBe(false);
    expect(() =>
      assertTransition("order", ORDER_TRANSITIONS, "CANCELLED", "CONFIRMED"),
    ).toThrow(IllegalTransitionError);
  });

  it("shipping cannot regress by rank (stale callbacks)", () => {
    expect(canTransition(FULFILLMENT_TRANSITIONS, "DELIVERED", "SHIPPED")).toBe(false);
    expect(canTransition(FULFILLMENT_TRANSITIONS, "SHIPPED", "RTO_IN_TRANSIT")).toBe(
      true,
    );
  });
});

describe("deriveAggregatePaymentStatus", () => {
  const base = {
    method: "PREPAID_RAZORPAY" as const,
    refunds: [],
    capturedAmountPaise: 0,
    refundedAmountPaise: 0,
  };

  it("a failed later attempt never downgrades a captured payment", () => {
    expect(
      deriveAggregatePaymentStatus({
        ...base,
        attempts: [{ status: "CAPTURED" }, { status: "FAILED" }],
        capturedAmountPaise: 100000,
      }),
    ).toBe("PAID");
  });

  it("PARTIALLY_REFUNDED then REFUNDED as refunds accumulate", () => {
    expect(
      deriveAggregatePaymentStatus({
        ...base,
        attempts: [{ status: "CAPTURED" }],
        capturedAmountPaise: 100000,
        refundedAmountPaise: 40000,
      }),
    ).toBe("PARTIALLY_REFUNDED");
    expect(
      deriveAggregatePaymentStatus({
        ...base,
        attempts: [{ status: "CAPTURED" }],
        capturedAmountPaise: 100000,
        refundedAmountPaise: 100000,
      }),
    ).toBe("REFUNDED");
  });

  it("COD: pending → collected", () => {
    expect(deriveAggregatePaymentStatus({ ...base, method: "COD", attempts: [] })).toBe(
      "COD_PENDING",
    );
    expect(
      deriveAggregatePaymentStatus({
        ...base,
        method: "COD",
        attempts: [{ status: "CAPTURED" }],
        capturedAmountPaise: 50000,
      }),
    ).toBe("COD_COLLECTED");
  });

  it("no attempts → UNPAID; only-failed → FAILED", () => {
    expect(deriveAggregatePaymentStatus({ ...base, attempts: [] })).toBe("UNPAID");
    expect(
      deriveAggregatePaymentStatus({ ...base, attempts: [{ status: "FAILED" }] }),
    ).toBe("FAILED");
  });
});

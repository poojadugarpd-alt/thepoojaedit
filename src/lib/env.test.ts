import { describe, expect, it } from "vitest";

import { assertNoLiveCredentialsOutsideProduction } from "./env";

// APP_ENV is "development" under vitest, so the guard is active.
describe("assertNoLiveCredentialsOutsideProduction", () => {
  it("passes when no live credentials are present", () => {
    expect(() =>
      assertNoLiveCredentialsOutsideProduction({
        NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_abc123",
      }),
    ).not.toThrow();
  });

  it("throws on a live Razorpay key outside production", () => {
    expect(() =>
      assertNoLiveCredentialsOutsideProduction({
        NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_live_abc123",
      }),
    ).toThrow(/live key/i);
  });

  it("throws on SENTRY_ENVIRONMENT=production outside production", () => {
    expect(() =>
      assertNoLiveCredentialsOutsideProduction({
        SENTRY_ENVIRONMENT: "production",
      }),
    ).toThrow(/SENTRY_ENVIRONMENT/);
  });
});

import { describe, expect, it } from "vitest";

import { resolveAppEnv } from "./app-env";

describe("resolveAppEnv", () => {
  it("prefers an explicit NEXT_PUBLIC_APP_ENV", () => {
    expect(
      resolveAppEnv({ NEXT_PUBLIC_APP_ENV: "preview", VERCEL_ENV: "production" }),
    ).toBe("preview");
  });

  it("falls back to VERCEL_ENV", () => {
    expect(resolveAppEnv({ VERCEL_ENV: "preview" })).toBe("preview");
    expect(resolveAppEnv({ VERCEL_ENV: "production" })).toBe("production");
  });

  it("ignores NODE_ENV — build mode is not deployment target", () => {
    expect(resolveAppEnv({ NODE_ENV: "production" })).toBe("development");
    expect(resolveAppEnv({})).toBe("development");
  });

  it("ignores an unrecognised value", () => {
    expect(resolveAppEnv({ NEXT_PUBLIC_APP_ENV: "staging" })).toBe("development");
  });
});

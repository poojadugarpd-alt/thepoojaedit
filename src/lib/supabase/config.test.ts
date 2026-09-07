import { describe, expect, it } from "vitest";

import { getSupabasePublicConfig, isSupabaseConfigured } from "./config";

// Vitest env sets no NEXT_PUBLIC_SUPABASE_* → Supabase is "not configured".
describe("supabase config (unconfigured)", () => {
  it("isSupabaseConfigured() is false", () => {
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("getSupabasePublicConfig() throws a helpful error", () => {
    expect(() => getSupabasePublicConfig()).toThrow(/not configured/i);
  });
});

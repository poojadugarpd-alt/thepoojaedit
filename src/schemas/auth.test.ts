import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "./auth";

describe("signUpSchema", () => {
  it("accepts a valid sign-up", () => {
    const r = signUpSchema.safeParse({
      email: "a@b.com",
      password: "hunter2hunter",
      name: "A B",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a short password", () => {
    expect(
      signUpSchema.safeParse({ email: "a@b.com", password: "short" }).success,
    ).toBe(false);
  });

  it("rejects a bad email", () => {
    expect(
      signUpSchema.safeParse({ email: "nope", password: "hunter2hunter" }).success,
    ).toBe(false);
  });
});

describe("signInSchema", () => {
  it("allows any non-empty password (policy is Supabase's)", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(
      true,
    );
  });
});

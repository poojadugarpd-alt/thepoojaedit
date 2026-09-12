/**
 * Public (browser-safe) environment.
 *
 * ONLY `NEXT_PUBLIC_*` values belong here. Everything in this file is inlined
 * into client bundles by Next.js, so it must never reference a secret.
 *
 * Values are read via explicit static property access (not a dynamic loop) so
 * that Next.js can statically replace them at build time.
 */
import { z } from "zod";

import { APP_ENVS } from "./app-env";

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .describe("Absolute base URL of this deployment, e.g. https://poojaedit.com"),
  NEXT_PUBLIC_APP_ENV: z
    .enum(APP_ENVS)
    .optional()
    .describe("Explicit environment override; normally derived, not set."),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .optional()
    .describe("Supabase project URL. Wired in Phase 3."),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1)
    .optional()
    .describe("Supabase publishable (client) key. Wired in Phase 3."),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z
    .string()
    .min(1)
    .optional()
    .describe("Razorpay key id (test or live). Wired in Phase 7."),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Public half of the VAPID keypair — passed to pushManager.subscribe() as the applicationServerKey. Admin PWA Stage 4.",
    ),
});

const parsed = PublicEnvSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid public environment configuration:\n${issues}\n` +
      `Set the missing NEXT_PUBLIC_* variables (see .env.example).`,
  );
}

export const publicEnv = parsed.data;

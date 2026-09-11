import "server-only";

/**
 * Server environment — validated once, at module load, and never sent to the client.
 *
 * Design rules (master spec §3):
 *  - Server and public env are validated separately. This file is server-only.
 *  - Missing *required* configuration throws a useful, aggregated error.
 *  - Provider secrets are optional until their phase wires them; a feature that
 *    needs one fails loudly at its call site, not here.
 *  - Preview/development must NOT be able to fall back to live credentials:
 *    `assertNoLiveCredentialsOutsideProduction()` rejects obviously-live values.
 */
import { z } from "zod";

import { APP_ENV, isProduction } from "./app-env";

const optionalNonEmpty = z.string().trim().min(1).optional();

const ServerEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // ── Database (Prisma 7 + Supabase Supavisor) — wired in Phase 2 ──────────
    DATABASE_URL: optionalNonEmpty.describe(
      "Supavisor transaction-pooler URL (port 6543, ?pgbouncer=true). Runtime client.",
    ),
    DIRECT_URL: optionalNonEmpty.describe(
      "Supavisor session-mode URL (port 5432) or direct connection. Prisma CLI.",
    ),
    SHADOW_DATABASE_URL: optionalNonEmpty.describe(
      "Optional disposable shadow database for `prisma migrate dev`.",
    ),

    // ── Supabase server key — wired in Phase 3 ──────────────────────────────
    SUPABASE_SECRET_KEY: optionalNonEmpty.describe(
      "Supabase secret (service) key. Server-only. Only if a flow needs it.",
    ),

    // ── Admin owner bootstrap (Phase 3) ───────────────────────────────────
    ADMIN_BOOTSTRAP_TOKEN: optionalNonEmpty.describe(
      "Secret required to create the first OWNER admin. Rotate/remove after use.",
    ),

    // ── Razorpay — wired in Phase 7 ────────────────────────────────────────
    RAZORPAY_KEY_SECRET: optionalNonEmpty,
    RAZORPAY_WEBHOOK_SECRET: optionalNonEmpty,

    // ── Shadowfax — wired in Phase 8 (master v1.1) ───────────────────────
    // Plain Token auth only (Authorization: Token <token>) — no client-id
    // header; the base URL switches staging/production on APP_ENV automatically
    // (dale.staging.shadowfax.in vs dale.shadowfax.in). See shadowfax.ts.
    SHADOWFAX_API_TOKEN: optionalNonEmpty,
    SHADOWFAX_WEBHOOK_TOKEN: optionalNonEmpty.describe(
      "Static token Shadowfax echoes on its callback, if the account configures one. Callback auth is weak by design; state is re-verified against the tracking API.",
    ),
    SHADOWFAX_API_BASE: optionalNonEmpty.describe(
      "Override the Shadowfax API base URL (defaults to the staging/production dale.*.shadowfax.in host picked by APP_ENV).",
    ),

    // ── WhatsApp (Meta Cloud API) — wired in Phase 10 ─────────────────────
    WHATSAPP_ACCESS_TOKEN: optionalNonEmpty,
    WHATSAPP_PHONE_NUMBER_ID: optionalNonEmpty,
    WHATSAPP_VERIFY_TOKEN: optionalNonEmpty,
    META_APP_SECRET: optionalNonEmpty,

    // ── Email (Resend) — wired in Phase 10 ───────────────────────────────
    RESEND_API_KEY: optionalNonEmpty,
    EMAIL_FROM: optionalNonEmpty.describe("Verified sender identity."),
    RESEND_WEBHOOK_SECRET: optionalNonEmpty.describe(
      "Resend delivery-webhook signing secret (Svix). If unset, the callback endpoint 401s.",
    ),

    // ── Background jobs (Inngest) — wired in Phase 6 ─────────────────────
    INNGEST_EVENT_KEY: optionalNonEmpty,
    INNGEST_SIGNING_KEY: optionalNonEmpty,

    // ── Instagram strip (Behold.so JSON feed) — optional ────────────────
    BEHOLD_FEED_ID: optionalNonEmpty.describe(
      "Behold.so feed id (feeds.behold.so/<id>). When unset or unreachable the homepage falls back to a curated product strip.",
    ),

    // ── Monitoring — harness in Phase 1, DSN optional ────────────────────
    SENTRY_DSN: optionalNonEmpty,
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((env, ctx) => {
    // Production requires the minimal set to be present. This gate exists now so
    // it is impossible to ship a production build without a database; the values
    // themselves land in Phase 2.
    if (isProduction) {
      for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when APP_ENV=production.`,
          });
        }
      }
    }
  });

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/**
 * Reject credentials that are unmistakably live when we are not in production.
 * This is a hard stop against a misconfigured preview/dev pointing at real money
 * or real customer data by accident.
 */
export function assertNoLiveCredentialsOutsideProduction(
  source: Record<string, string | undefined> = process.env,
): void {
  if (isProduction) return;

  const violations: string[] = [];
  const razorpayId = source.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (razorpayId?.startsWith("rzp_live_")) {
    violations.push("NEXT_PUBLIC_RAZORPAY_KEY_ID is a live key (rzp_live_…)");
  }
  if (source.SENTRY_ENVIRONMENT === "production") {
    violations.push("SENTRY_ENVIRONMENT is 'production'");
  }

  if (violations.length > 0) {
    throw new Error(
      `Live credentials detected while APP_ENV=${APP_ENV}:\n` +
        violations.map((v) => `  • ${v}`).join("\n") +
        `\nPreview and development must use test credentials only.`,
    );
  }
}

const parsed = ServerEnvSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid server environment configuration:\n${formatIssues(parsed.error)}\n` +
      `See .env.example for the full list.`,
  );
}

assertNoLiveCredentialsOutsideProduction();

export const env = parsed.data;
export type ServerEnv = typeof env;

/** Narrow helper: get a value that a later phase promises to have set. */
export function requireEnv<K extends keyof ServerEnv>(
  key: K,
): NonNullable<ServerEnv[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Required environment variable ${String(key)} is not set in APP_ENV=${APP_ENV}.`,
    );
  }
  return value as NonNullable<ServerEnv[K]>;
}

/**
 * Next.js instrumentation hook. Runs once per server process on startup.
 *
 * Phase 1: logs the boot with its environment identity and validates server env
 * eagerly (so a misconfigured deploy fails fast instead of on first request).
 * Sentry initialisation is added here in a later phase, guarded by SENTRY_DSN.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { env } = await import("@/lib/env");
    const { logger } = await import("@/lib/logger");
    const { APP_ENV } = await import("@/lib/app-env");
    logger.info(
      { appEnv: APP_ENV, logLevel: env.LOG_LEVEL },
      "poojaedit server started",
    );
  }
}

import "server-only";

/**
 * Structured logging with sensitive-data redaction (master spec §2, §9).
 *
 * - JSON to stdout by default (works on Vercel / any log drain).
 * - Set `LOG_PRETTY=1` locally for human-readable output.
 * - `redact` scrubs secrets and PII before anything is written. Add new paths
 *   here as models grow; never log a raw provider payload without a redaction
 *   path for its secret fields.
 */
import pino, { type Logger } from "pino";

import { APP_ENV } from "./app-env";
import { env } from "./env";

const REDACT_PATHS = [
  // credentials / tokens
  "password",
  "*.password",
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "headers.cookie",
  "cookie",
  "*.cookie",
  "apiKey",
  "*.apiKey",
  "secret",
  "*.secret",
  "*.keySecret",
  "webhookSecret",
  "*.webhookSecret",
  "signature",
  "*.signature",
  // customer PII
  "email",
  "*.email",
  "phone",
  "*.phone",
  "contact",
  "*.contact",
  "address",
  "*.address",
  "otp",
  "*.otp",
  // payment identifiers we never want in plaintext logs
  "card",
  "*.card",
  "cvv",
  "*.cvv",
  "upi",
  "*.upi",
];

const pretty =
  process.env.LOG_PRETTY === "1"
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      }
    : undefined;

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { env: APP_ENV, service: "poojaedit" },
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(pretty ? { transport: pretty } : {}),
});

/** Child logger bound to a request/operation scope. */
export function scopedLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

/**
 * Environment identity — shared by server and client code.
 *
 * `APP_ENV` is the single source of truth for which DEPLOYMENT we are in — not
 * the build mode. `next build` always runs with `NODE_ENV=production`, so
 * `NODE_ENV` deliberately plays no part here; a local or CI build is
 * `development` unless something explicitly says otherwise.
 *
 * Derived, in order of precedence, from:
 *   1. an explicit `NEXT_PUBLIC_APP_ENV` value
 *   2. Vercel's `VERCEL_ENV` (`production` | `preview` | `development`)
 *   3. otherwise `development`
 *
 * Keeping this tiny and dependency-free means it is safe to import from anywhere,
 * including the Edge middleware and client components.
 */

export const APP_ENVS = ["development", "preview", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

function coerce(value: string | undefined): AppEnv | undefined {
  if (value && (APP_ENVS as readonly string[]).includes(value)) {
    return value as AppEnv;
  }
  return undefined;
}

export function resolveAppEnv(
  source: Record<string, string | undefined> = process.env,
): AppEnv {
  return (
    coerce(source.NEXT_PUBLIC_APP_ENV) ?? coerce(source.VERCEL_ENV) ?? "development"
  );
}

export const APP_ENV: AppEnv = resolveAppEnv();

export const isProduction = APP_ENV === "production";
export const isPreview = APP_ENV === "preview";
export const isDevelopment = APP_ENV === "development";

/** Human-readable label for the admin environment banner. */
export const APP_ENV_LABEL: Record<AppEnv, string> = {
  development: "Development",
  preview: "Preview",
  production: "Production",
};

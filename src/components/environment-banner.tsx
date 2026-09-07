import { APP_ENV, APP_ENV_LABEL, isProduction } from "@/lib/app-env";

/**
 * Visible environment identifier (master spec §3: "Identify each environment
 * visibly"). Renders nothing in production; a thin strip everywhere else so a
 * preview build can never be mistaken for the live store.
 */
export function EnvironmentBanner() {
  if (isProduction) return null;

  return (
    <div
      role="status"
      className="w-full bg-amber-400 px-4 py-1 text-center text-xs font-semibold tracking-wide text-amber-950"
    >
      {APP_ENV_LABEL[APP_ENV]} environment — not the live store
      <span className="sr-only"> (APP_ENV={APP_ENV})</span>
    </div>
  );
}

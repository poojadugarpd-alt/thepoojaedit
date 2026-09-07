import { type NextRequest } from "next/server";

import { APP_ENV } from "@/lib/app-env";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Coarse edge middleware (master spec §2, §9).
 *
 * - Refreshes the Supabase auth session cookie (no-op until Supabase is
 *   configured).
 * - Stamps a request id and the environment identity.
 *
 * Keep Node-only imports out of this file (no `env.ts`, no `pino`).
 */
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  response.headers.set("x-request-id", crypto.randomUUID());
  response.headers.set("x-app-env", APP_ENV);
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and common static files.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

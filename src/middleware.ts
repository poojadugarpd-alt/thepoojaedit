import { NextResponse, type NextRequest } from "next/server";

import { APP_ENV } from "@/lib/app-env";

/**
 * Coarse edge middleware (master spec §2, §9).
 *
 * Phase 1: attaches a request id and the environment identity, nothing more.
 * Phase 3 adds Supabase session-cookie refresh here using a Next.js 15-compatible
 * SSR client. Keep this file free of Node-only imports (no `env.ts`, no `pino`).
 */
export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-app-env", APP_ENV);
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and common static files.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

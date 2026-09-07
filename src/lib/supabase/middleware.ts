import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicConfig, isSupabaseConfigured } from "./config";

/**
 * Refresh the Supabase auth session on every request and write the rotated
 * cookies onto the response (Next.js 15-compatible middleware — current Supabase
 * examples may use a newer framework's `proxy.ts` naming; this stays on
 * `middleware.ts`, master spec §9).
 *
 * No-op when Supabase is not configured so local dev works without a project.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });

  if (!isSupabaseConfigured()) return response;

  const { url, publishableKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() triggers the refresh + cookie rotation.
  await supabase.auth.getUser();

  return response;
}

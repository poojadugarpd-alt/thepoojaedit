import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "./config";

/**
 * Supabase client bound to the current request's cookies (App Router).
 *
 * Reads/refreshes the auth session from cookies. Identity is only trusted after
 * `supabase.auth.getUser()` (which re-validates the JWT with Supabase) — never
 * `getSession()` alone (master spec §9). Cookie writes from a Server Component
 * are swallowed; the middleware is responsible for persisting refreshed cookies.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — safe to ignore; middleware refreshes.
        }
      },
    },
  });
}

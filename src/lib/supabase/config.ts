import { publicEnv } from "@/lib/public-env";

/**
 * Supabase connection config, resolved from the public env. Auth + Storage only —
 * never used for commerce reads/writes (those go through Prisma).
 *
 * When Supabase is not configured (local dev before a project exists) the client
 * factories throw a clear error and `isSupabaseConfigured()` returns false so the
 * middleware / routes can degrade gracefully instead of constructing a broken
 * client.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL &&
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabasePublicConfig(): {
  url: string;
  publishableKey: string;
} {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see docs/supabase-setup.md).",
    );
  }
  return { url, publishableKey };
}

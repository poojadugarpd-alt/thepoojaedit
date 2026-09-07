import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface VerifiedIdentity {
  authUserId: string;
  email: string | null;
}

/**
 * The single Supabase-auth seam. Returns an identity ONLY after
 * `supabase.auth.getUser()` re-validates the JWT with Supabase — cookie
 * contents / `getSession()` are never trusted for authorization (master §9).
 * Returns null for guests and when Supabase is not configured.
 */
export async function getVerifiedIdentity(): Promise<VerifiedIdentity | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return { authUserId: data.user.id, email: data.user.email ?? null };
}

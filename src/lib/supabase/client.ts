import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "./config";

/**
 * Browser Supabase client for interactive auth flows (sign in/up/out, password
 * reset). Uses the publishable key only. Commerce data never goes through here.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createBrowserClient(url, publishableKey);
}

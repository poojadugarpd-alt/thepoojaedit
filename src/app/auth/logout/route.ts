import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sign out and return to the storefront. POST only (a link can't be
 * pre-fetched into a logout).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}

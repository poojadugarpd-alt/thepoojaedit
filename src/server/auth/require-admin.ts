import "server-only";

import type { AdminUser } from "@/generated/prisma";
import { isDevelopment } from "@/lib/app-env";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertActiveAdmin, assertRole, resolveAdmin } from "@/server/admin/guards";

import { AuthenticationError } from "./errors";
import { getVerifiedIdentity } from "./identity";

/**
 * DEV ONLY: when Supabase auth is not configured yet (Phase 3 is a local slice),
 * `DEV_ADMIN_AUTH=1` lets the admin UI resolve to the first active admin so it
 * can be built and reviewed. Never fires in preview/production, never when
 * Supabase IS configured. Storefront customer identity is unaffected — this
 * path is only in `requireAdmin`, not `getVerifiedIdentity`.
 */
async function devAdminFallback(): Promise<AdminUser | null> {
  if (!isDevelopment || isSupabaseConfigured() || process.env.DEV_ADMIN_AUTH !== "1") {
    return null;
  }
  const admin = await prisma.adminUser.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (admin) {
    logger.warn(
      { adminId: admin.id },
      "DEV_ADMIN_AUTH: admin access granted without Supabase auth (development only)",
    );
  }
  return admin;
}

/**
 * Every sensitive admin action calls this itself — never relies on route
 * protection (master §9). Throws AuthenticationError (401) if not signed in,
 * AuthorizationError (403) if not an active admin.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const identity = await getVerifiedIdentity();
  if (!identity) {
    const dev = await devAdminFallback();
    if (dev) return dev;
    throw new AuthenticationError();
  }

  const admin = await resolveAdmin(prisma, identity.authUserId);
  assertActiveAdmin(admin);
  return admin;
}

export async function requireOwner(): Promise<AdminUser> {
  const admin = await requireAdmin();
  assertRole(admin, "OWNER");
  return admin;
}

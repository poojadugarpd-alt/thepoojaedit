import "server-only";

import type { AdminUser } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { assertActiveAdmin, assertRole, resolveAdmin } from "@/server/admin/guards";

import { AuthenticationError } from "./errors";
import { getVerifiedIdentity } from "./identity";

/**
 * Every sensitive admin action calls this itself — never relies on route
 * protection (master §9). Throws AuthenticationError (401) if not signed in,
 * AuthorizationError (403) if not an active admin.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const identity = await getVerifiedIdentity();
  if (!identity) throw new AuthenticationError();

  const admin = await resolveAdmin(prisma, identity.authUserId);
  assertActiveAdmin(admin);
  return admin;
}

export async function requireOwner(): Promise<AdminUser> {
  const admin = await requireAdmin();
  assertRole(admin, "OWNER");
  return admin;
}

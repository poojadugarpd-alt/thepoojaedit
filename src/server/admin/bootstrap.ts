import "server-only";

import type { AdminUser, PrismaClient } from "@/generated/prisma";
import { AuthorizationError } from "@/server/auth/errors";

/**
 * Create the first OWNER. Deliberately NOT a public escalation route
 * (playbook Phase 3 checkpoint):
 *   1. the caller must present the secret `ADMIN_BOOTSTRAP_TOKEN`, and
 *   2. it only works while zero active admins exist.
 * Rotate/remove the token after first use.
 */
export async function bootstrapOwner(
  deps: { db: PrismaClient; bootstrapToken: string | undefined },
  input: { authUserId: string; email: string; providedToken: string },
): Promise<AdminUser> {
  if (!deps.bootstrapToken || input.providedToken !== deps.bootstrapToken) {
    throw new AuthorizationError("Invalid bootstrap token");
  }

  const activeAdmins = await deps.db.adminUser.count({
    where: { isActive: true },
  });
  if (activeAdmins > 0) {
    throw new AuthorizationError("An active admin already exists; bootstrap is closed");
  }

  return deps.db.adminUser.upsert({
    where: { authUserId: input.authUserId },
    update: { role: "OWNER", isActive: true },
    create: {
      authUserId: input.authUserId,
      email: input.email,
      role: "OWNER",
      isActive: true,
    },
  });
}

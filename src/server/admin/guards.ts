import "server-only";

import type { AdminRole, AdminUser, PrismaClient } from "@/generated/prisma";
import { AuthorizationError, ResourceNotFoundError } from "@/server/auth/errors";

/**
 * Pure authorization checks over the commerce database. `require*` helpers in
 * `src/server/auth` compose these with the verified Supabase identity. Client
 * metadata never grants a role — role + active flag come from `AdminUser` only
 * (master spec §9).
 */

export function resolveAdmin(
  db: PrismaClient,
  authUserId: string,
): Promise<AdminUser | null> {
  return db.adminUser.findUnique({ where: { authUserId } });
}

export function assertActiveAdmin(admin: AdminUser | null): asserts admin is AdminUser {
  if (!admin || !admin.isActive) {
    throw new AuthorizationError("Admin access required");
  }
}

export function assertRole(admin: AdminUser, ...allowed: AdminRole[]): void {
  if (!allowed.includes(admin.role)) {
    throw new AuthorizationError(`Requires role: ${allowed.join(" or ")}`);
  }
}

/**
 * Ownership guard for a logged-in customer. Returns "not found" (never
 * "forbidden") for someone else's order or a guest order, to resist enumeration.
 */
export async function assertOwnsOrder(
  db: PrismaClient,
  customerId: string | null,
  orderId: string,
): Promise<void> {
  if (!customerId) throw new ResourceNotFoundError();
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { customerId: true },
  });
  if (!order || order.customerId !== customerId) {
    throw new ResourceNotFoundError();
  }
}

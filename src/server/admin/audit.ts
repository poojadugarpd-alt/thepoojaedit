import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Append an immutable admin-activity record (master §10). `before` / `after`
 * capture the changed shape; `reason` is required for consequential actions by
 * convention (the callers pass it).
 */
export async function auditLog(
  db: Db,
  input: {
    adminUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    reason?: string | null;
  },
): Promise<void> {
  await db.adminActivityLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before:
        input.before === undefined
          ? undefined
          : (input.before as Prisma.InputJsonValue),
      after:
        input.after === undefined ? undefined : (input.after as Prisma.InputJsonValue),
      reason: input.reason ?? null,
    },
  });
}

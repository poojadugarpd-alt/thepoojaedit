import "server-only";

import type { PrismaClient } from "@/generated/prisma";

/** Admin activity feed (master §10). Immutable; read-only. */
export async function listActivity(
  db: PrismaClient,
  opts: { entityType?: string; entityId?: string; limit?: number } = {},
) {
  return db.adminActivityLog.findMany({
    where: {
      ...(opts.entityType ? { entityType: opts.entityType } : {}),
      ...(opts.entityId ? { entityId: opts.entityId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opts.limit ?? 100, 1), 300),
    include: { adminUser: { select: { email: true } } },
  });
}

import "server-only";

import type { OperationalTaskType, Prisma, PrismaClient } from "@/generated/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Operational-task service (master §10). A task is deduplicated by `dedupeKey`
 * and surfaces the underlying condition ONCE. It is resolved when the condition
 * is actually resolved — not merely when an operator reads the alert. A new
 * occurrence of an already-resolved condition reopens the task.
 */
export async function openOperationalTask(
  db: Db,
  input: {
    dedupeKey: string;
    type: OperationalTaskType;
    entityType?: string | null;
    entityId?: string | null;
    priority?: number;
    reason?: string | null;
  },
) {
  return db.operationalTask.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {
      // reopen if it had been resolved; leave an already-open task untouched
      status: "OPEN",
      resolvedAt: null,
      ...(input.reason ? { reason: input.reason } : {}),
    },
    create: {
      dedupeKey: input.dedupeKey,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      priority: input.priority ?? 0,
      reason: input.reason ?? null,
      status: "OPEN",
    },
  });
}

export async function resolveOperationalTask(
  db: Db,
  dedupeKey: string,
): Promise<boolean> {
  const res = await db.operationalTask.updateMany({
    where: { dedupeKey, status: "OPEN" },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  return res.count > 0;
}

export function listOpenOperationalTasks(
  db: Db,
  opts: { type?: OperationalTaskType; limit?: number } = {},
) {
  return db.operationalTask.findMany({
    where: { status: "OPEN", ...(opts.type ? { type: opts.type } : {}) },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: Math.min(Math.max(opts.limit ?? 100, 1), 500),
  });
}

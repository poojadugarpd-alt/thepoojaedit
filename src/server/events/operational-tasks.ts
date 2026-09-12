import "server-only";

import type { OperationalTaskType, Prisma, PrismaClient } from "@/generated/prisma";
import { sendAdminPush, type PushPreferenceField } from "@/server/notifications/push";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Operational-task service (master §10). A task is deduplicated by `dedupeKey`
 * and surfaces the underlying condition ONCE. It is resolved when the condition
 * is actually resolved — not merely when an operator reads the alert. A new
 * occurrence of an already-resolved condition reopens the task.
 */

// Maps straight onto AdminNotificationPreference's fields (admin PWA Stage 4).
// COD_CONFIRMATION/INVENTORY_CONFLICT/REFUND_FAILURE/INVOICE_FAILURE have no
// field in that model (not part of the decided preference set) and simply
// don't push — the task itself still opens and still shows in Needs
// Attention either way, this only affects the phone alert.
const TASK_PUSH_PREFERENCE: Partial<Record<OperationalTaskType, PushPreferenceField>> = {
  PAYMENT_REVIEW: "paymentIssue",
  SHIPMENT_FAILURE: "shipmentFailure",
  JOB_FAILURE: "jobExhausted",
  LOW_STOCK: "lowStock",
  NDR: "ndrRto",
  RTO_INSPECTION: "ndrRto",
};

const TASK_PUSH_TITLE: Partial<Record<OperationalTaskType, string>> = {
  PAYMENT_REVIEW: "Payment needs review",
  SHIPMENT_FAILURE: "Shipment problem",
  JOB_FAILURE: "Background job failing",
  LOW_STOCK: "Low stock",
  NDR: "Delivery failed",
  RTO_INSPECTION: "Return to inspect",
};

const TASK_PUSH_PATH: Partial<Record<OperationalTaskType, string>> = {
  PAYMENT_REVIEW: "/admin/needs-attention",
  SHIPMENT_FAILURE: "/admin/needs-attention",
  JOB_FAILURE: "/admin/needs-attention",
  LOW_STOCK: "/admin/inventory",
  NDR: "/admin/needs-attention",
  RTO_INSPECTION: "/admin/returns",
};

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
  const before = await db.operationalTask.findUnique({ where: { dedupeKey: input.dedupeKey } });

  const task = await db.operationalTask.upsert({
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

  // Only push for a task that is newly OPEN (didn't exist, or was RESOLVED),
  // not on every re-affirming call while it stays open — except LOW_STOCK,
  // which is deliberately allowed to push once per day even if the task was
  // already open (decision #3, admin-pwa-plan.md §6) since further sales can
  // keep calling this for the same variant all day. `sendAdminPush`'s own
  // dedupe key is what actually enforces "once", not this check.
  const justOpened = !before || before.status !== "OPEN";
  const preferenceField = TASK_PUSH_PREFERENCE[input.type];

  // Never attempt network I/O from inside an open DB transaction — `tx`
  // (Prisma.TransactionClient) lacks `$transaction` itself; a real
  // PrismaClient has it. A task opened mid-transaction simply doesn't push
  // from here (rare in this codebase — most call sites already open tasks
  // after their transaction commits).
  const isRealClient = "$transaction" in db;

  if (preferenceField && isRealClient && (justOpened || input.type === "LOW_STOCK")) {
    const dedupeKey =
      input.type === "LOW_STOCK"
        ? `low-stock-push:${input.entityId}:${new Date().toISOString().slice(0, 10)}`
        : `task-push:${task.id}`;
    await sendAdminPush(db as PrismaClient, {
      dedupeKey,
      preferenceField,
      title: TASK_PUSH_TITLE[input.type] ?? "Needs attention",
      body: input.reason ?? task.reason ?? "Open in the admin.",
      path: TASK_PUSH_PATH[input.type] ?? "/admin/needs-attention",
    }).catch(() => {});
  }

  return task;
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

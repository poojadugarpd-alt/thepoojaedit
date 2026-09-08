import "server-only";

import type { OperationalTask, PrismaClient } from "@/generated/prisma";
import { resolveOperationalTask } from "@/server/events/operational-tasks";

import { auditLog } from "./audit";

/**
 * Needs-Attention queue over `OperationalTask` (master §10). A task is resolved
 * when the underlying condition is gone — not merely when the alert is read.
 * `resolveTaskChecked` re-verifies the condition for the task types where it can;
 * for the rest an explicit `force` + reason is required and audited.
 */

export interface AttentionTask {
  id: string;
  dedupeKey: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  priority: number;
  reason: string | null;
  createdAt: Date;
}

export async function listOpenTasks(
  db: PrismaClient,
  opts: { type?: string; limit?: number } = {},
): Promise<AttentionTask[]> {
  const rows = await db.operationalTask.findMany({
    where: { status: "OPEN", ...(opts.type ? { type: opts.type as never } : {}) },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: Math.min(Math.max(opts.limit ?? 100, 1), 300),
  });
  return rows.map((t) => ({
    id: t.id,
    dedupeKey: t.dedupeKey,
    type: t.type as string,
    entityType: t.entityType,
    entityId: t.entityId,
    priority: t.priority,
    reason: t.reason,
    createdAt: t.createdAt,
  }));
}

/** True when the condition behind the task is verifiably gone. `null` = can't tell. */
async function conditionCleared(
  db: PrismaClient,
  task: OperationalTask,
): Promise<boolean | null> {
  const key = task.dedupeKey;
  if (key.startsWith("outbox:") && key !== "outbox:health") {
    const id = key.slice("outbox:".length);
    const ev = await db.outboxEvent.findUnique({ where: { id } });
    return ev ? ev.status !== "FAILED" : true;
  }
  if (key === "outbox:health") {
    const bad = await db.outboxEvent.count({
      where: {
        OR: [{ status: "FAILED" }, { status: "DISPATCHING" }],
      },
    });
    return bad === 0;
  }
  if (key.startsWith("payment-review:") && task.entityType === "Order" && task.entityId) {
    const o = await db.order.findUnique({ where: { id: task.entityId } });
    return o ? o.orderStatus !== "NEEDS_REVIEW" : true;
  }
  if (key.startsWith("low-stock:") && task.entityId) {
    const v = await db.productVariant.findUnique({ where: { id: task.entityId } });
    if (!v) return true;
    return v.lowStockThreshold <= 0 || v.onHandQty - v.reservedQty > v.lowStockThreshold;
  }
  if (key.startsWith("cod-remittance:") && task.entityId) {
    const disputed = await db.codRemittance.count({
      where: { orderId: task.entityId, status: "DISPUTED" },
    });
    return disputed === 0;
  }
  if (key.startsWith("shipment-failure:") && task.entityType === "Order" && task.entityId) {
    const s = await db.shipment.findFirst({
      where: { orderId: task.entityId, providerShipmentId: { not: null } },
    });
    return Boolean(s);
  }
  if (key.startsWith("invoice-pdf:") && task.entityId) {
    const inv = await db.invoice.findUnique({ where: { id: task.entityId } });
    return Boolean(inv?.pdfPath);
  }
  if (key.startsWith("notification:") && task.entityId) {
    const d = await db.notificationDelivery.findUnique({ where: { id: task.entityId } });
    return d ? d.status !== "FAILED" : true;
  }
  return null; // NDR / RTO_INSPECTION / refund-failure / etc. — operator judgement
}

export class TaskStillActiveError extends Error {}

export async function resolveTaskChecked(
  db: PrismaClient,
  input: { taskId: string; adminUserId: string; reason?: string; force?: boolean },
): Promise<{ resolved: boolean }> {
  const task = await db.operationalTask.findUniqueOrThrow({ where: { id: input.taskId } });
  if (task.status === "RESOLVED") return { resolved: true };

  const cleared = await conditionCleared(db, task);
  if (cleared === false && !input.force) {
    throw new TaskStillActiveError(
      `"${task.dedupeKey}" — the underlying condition is still active. Fix it, or resolve with a reason to override.`,
    );
  }
  if (cleared === null && !input.force) {
    throw new TaskStillActiveError(
      `"${task.type}" needs a manual decision — resolve with a reason confirming it's handled.`,
    );
  }

  await resolveOperationalTask(db, task.dedupeKey);
  await auditLog(db, {
    adminUserId: input.adminUserId,
    action: "task.resolve",
    entityType: "OperationalTask",
    entityId: task.id,
    after: { dedupeKey: task.dedupeKey, forced: Boolean(input.force) && cleared !== true },
    reason: input.reason ?? null,
  });
  return { resolved: true };
}

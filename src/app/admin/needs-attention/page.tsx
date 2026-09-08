import Link from "next/link";

import { prisma } from "@/lib/db";
import { ActionForm } from "@/features/admin/action-form";
import { BulkForm } from "@/features/admin/bulk-form";
import { ts } from "@/features/admin/format";
import { Poll } from "@/features/admin/poll";
import { listOpenTasks } from "@/server/admin";

import { bulkResolveTasksAction, resolveTaskAction } from "./actions";

export const dynamic = "force-dynamic";

function entityHref(t: { entityType: string | null; entityId: string | null; dedupeKey: string }) {
  if (t.dedupeKey.startsWith("low-stock:")) return "/admin/inventory";
  if (t.entityType === "Order" && t.entityId) return `/admin/orders?q=${t.entityId}`;
  if (t.entityType === "Shipment") return "/admin/returns";
  if (t.entityType === "NotificationDelivery") return "/admin/notifications";
  return null;
}

export default async function NeedsAttentionPage() {
  const tasks = await listOpenTasks(prisma, { limit: 200 });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Needs Attention</h1>
        <Poll baseMs={12_000} />
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-black/55 dark:text-white/55">Nothing open. 🎉</p>
      ) : (
        <>
          <p className="text-xs text-black/50 dark:text-white/50">
            {tasks.length} open. A task clears only when its condition is gone — bulk
            resolve skips any that are still active or need a decision, and reports
            each skip.
          </p>

          <BulkForm
            action={bulkResolveTasksAction}
            submitLabel="Resolve selected"
            items={tasks.map((t) => ({
              id: t.id,
              node: (
                <div>
                  <p>
                    <span className="font-medium">{t.type.replaceAll("_", " ")}</span>{" "}
                    <span className="text-[11px] text-black/45 dark:text-white/45">
                      {t.dedupeKey}
                    </span>
                  </p>
                  <p className="text-xs text-black/60 dark:text-white/60">{t.reason}</p>
                  <p className="text-[11px] text-black/40 dark:text-white/40">
                    since {ts(t.createdAt)}
                    {entityHref(t) && (
                      <>
                        {" · "}
                        <Link href={entityHref(t)!} className="underline">
                          open
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              ),
            }))}
          />

          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-black/50 dark:text-white/50">
              Resolve one with an override reason
            </summary>
            <ul className="mt-2 space-y-3">
              {tasks.map((t) => (
                <li key={t.id} className="rounded border border-black/10 p-2 dark:border-white/15">
                  <p className="text-xs">
                    <span className="font-medium">{t.type}</span> · {t.dedupeKey}
                  </p>
                  <ActionForm action={resolveTaskAction} submitLabel="Resolve" compact>
                    <input type="hidden" name="taskId" value={t.id} />
                    <input
                      name="reason"
                      placeholder="reason"
                      className="w-full rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
                    />
                    <label className="flex items-center gap-1 text-[11px]">
                      <input type="checkbox" name="force" value="1" /> override — I
                      have verified this is handled
                    </label>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

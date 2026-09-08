import { prisma } from "@/lib/db";
import { ActionForm } from "@/features/admin/action-form";
import { Pill, ts } from "@/features/admin/format";
import { Poll } from "@/features/admin/poll";

import { retryNotificationAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const [failed, recent] = await Promise.all([
    prisma.notificationDelivery.findMany({
      where: { status: "FAILED" },
      orderBy: { queuedAt: "desc" },
      take: 40,
    }),
    prisma.notificationDelivery.findMany({
      orderBy: { queuedAt: "desc" },
      take: 40,
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <Poll />
      </div>

      <section>
        <h2 className="text-sm font-semibold">Failed ({failed.length})</h2>
        {failed.length === 0 ? (
          <p className="text-xs text-black/45">None.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {failed.map((d) => (
              <li key={d.id} className="rounded border border-rose-500/20 p-2">
                <p>
                  {d.channel} · {d.templateKey} v{d.templateVersion} · {d.recipient}
                </p>
                <p className="text-rose-600">{d.lastError}</p>
                <ActionForm action={retryNotificationAction} submitLabel="Retry" compact>
                  <input type="hidden" name="deliveryId" value={d.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold">Recent</h2>
        <table className="mt-2 w-full text-xs">
          <tbody>
            {recent.map((d) => (
              <tr key={d.id} className="border-b border-black/10 dark:border-white/10">
                <td className="py-1">{ts(d.queuedAt)}</td>
                <td className="py-1">{d.channel}</td>
                <td className="py-1">{d.templateKey}</td>
                <td className="py-1">{d.recipient}</td>
                <td className="py-1">
                  <Pill value={d.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

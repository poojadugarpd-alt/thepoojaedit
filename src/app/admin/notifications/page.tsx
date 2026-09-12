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
        <h1 className="text-xl font-semibold text-ink-strong">Notifications</h1>
        <Poll />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink-strong">Failed ({failed.length})</h2>
        {failed.length === 0 ? (
          <p className="text-xs text-ink-soft">None.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {failed.map((d) => (
              <li key={d.id} className="rounded border border-stop/30 bg-stop-bg/40 p-2">
                <p className="text-ink">
                  {d.channel} · {d.templateKey} v{d.templateVersion} · {d.recipient}
                </p>
                <p className="text-stop">{d.lastError}</p>
                <ActionForm action={retryNotificationAction} submitLabel="Retry" compact>
                  <input type="hidden" name="deliveryId" value={d.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink-strong">Recent</h2>

        {/* Mobile: card list */}
        <ul className="mt-2 space-y-2 text-xs sm:hidden">
          {recent.map((d) => (
            <li key={d.id} className="rounded border border-line p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink-strong">{d.channel}</span>
                <Pill value={d.status} />
              </div>
              <p className="mt-0.5 text-ink-soft">
                {d.templateKey} · {d.recipient}
              </p>
              <p className="text-ink-soft">{ts(d.queuedAt)}</p>
            </li>
          ))}
          {recent.length === 0 && (
            <li className="py-4 text-center text-ink-soft">No deliveries yet.</li>
          )}
        </ul>

        {/* Desktop: table */}
        <table className="mt-2 hidden w-full text-xs sm:table">
          <tbody>
            {recent.map((d) => (
              <tr key={d.id} className="border-b border-line/60">
                <td className="py-1 text-ink-soft">{ts(d.queuedAt)}</td>
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

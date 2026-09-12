import { prisma } from "@/lib/db";
import { ts } from "@/features/admin/format";
import { listActivity } from "@/server/admin";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const rows = await listActivity(prisma, { limit: 150 });
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-ink-strong">Activity log</h1>
      <p className="text-xs text-ink-soft">
        Immutable record of admin actions — who, what, when, why.
      </p>

      {/* Mobile: card list */}
      <ul className="space-y-2 text-xs sm:hidden">
        {rows.map((a) => (
          <li key={a.id} className="rounded border border-line p-2">
            <p className="font-medium text-ink-strong">
              {a.action} · {a.entityType} {a.entityId.slice(0, 8)}
            </p>
            <p className="text-ink-soft">
              {a.adminUser.email} · {ts(a.createdAt)}
            </p>
            {a.reason && <p className="mt-0.5 text-ink">{a.reason}</p>}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-6 text-center text-ink-soft">No activity yet.</li>
        )}
      </ul>

      {/* Desktop: table */}
      <table className="hidden w-full text-xs sm:table">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 font-medium">When</th>
            <th className="py-2 font-medium">Admin</th>
            <th className="py-2 font-medium">Action</th>
            <th className="py-2 font-medium">Entity</th>
            <th className="py-2 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-line/60">
              <td className="py-1.5 text-ink-soft">{ts(a.createdAt)}</td>
              <td className="py-1.5">{a.adminUser.email}</td>
              <td className="py-1.5 font-medium">{a.action}</td>
              <td className="py-1.5">
                {a.entityType} {a.entityId.slice(0, 8)}
              </td>
              <td className="py-1.5">{a.reason ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-ink-soft">
                No activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

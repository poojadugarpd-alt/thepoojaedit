import { prisma } from "@/lib/db";
import { ts } from "@/features/admin/format";
import { listActivity } from "@/server/admin";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const rows = await listActivity(prisma, { limit: 150 });
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Activity log</h1>
      <p className="text-xs text-black/50 dark:text-white/50">
        Immutable record of admin actions — who, what, when, why.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-black/15 text-left dark:border-white/20">
            <th className="py-2 font-medium">When</th>
            <th className="py-2 font-medium">Admin</th>
            <th className="py-2 font-medium">Action</th>
            <th className="py-2 font-medium">Entity</th>
            <th className="py-2 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-black/10 dark:border-white/10">
              <td className="py-1.5">{ts(a.createdAt)}</td>
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
              <td colSpan={5} className="py-6 text-center text-black/45">
                No activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

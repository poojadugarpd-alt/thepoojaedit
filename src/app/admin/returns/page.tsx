import Link from "next/link";

import { prisma } from "@/lib/db";
import { Pill, ts } from "@/features/admin/format";

export const dynamic = "force-dynamic";

const STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "IN_TRANSIT",
  "RECEIVED",
  "INSPECTED",
  "RESOLVED",
];

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const rows = await prisma.returnRequest.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { order: { select: { orderNumber: true } }, items: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink-strong">Returns</h1>

      <form className="flex items-center gap-2">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="min-h-11 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
        >
          <option value="">any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button className="min-h-11 rounded border border-line px-3 text-sm">Filter</button>
      </form>

      {/* Mobile: card list */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <li key={r.id} className="rounded border border-line p-3">
            <Link href={`/admin/returns/${r.id}`} className="block">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-strong">{r.id.slice(0, 8)}</span>
                <Pill value={r.status} />
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                Order {r.order.orderNumber} · {r.items.length} item(s) · {ts(r.createdAt)}
              </p>
              <p className="mt-1 text-xs text-ink">{r.reason}</p>
            </Link>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-soft">No returns yet.</li>
        )}
      </ul>

      {/* Desktop: table */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 font-medium">Return</th>
            <th className="py-2 font-medium">Order</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Reason</th>
            <th className="py-2 font-medium">Items</th>
            <th className="py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/60">
              <td className="py-2">
                <Link href={`/admin/returns/${r.id}`} className="font-medium hover:underline">
                  {r.id.slice(0, 8)}
                </Link>
              </td>
              <td className="py-2">
                <Link href={`/admin/orders/${r.order.orderNumber}`} className="hover:underline">
                  {r.order.orderNumber}
                </Link>
              </td>
              <td className="py-2">
                <Pill value={r.status} />
              </td>
              <td className="py-2 text-xs">{r.reason}</td>
              <td className="py-2">{r.items.length}</td>
              <td className="py-2 text-xs text-ink-soft">{ts(r.createdAt)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-ink-soft">
                No returns yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

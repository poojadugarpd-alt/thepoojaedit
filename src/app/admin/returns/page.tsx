import Link from "next/link";

import { prisma } from "@/lib/db";
import { Pill, ts } from "@/features/admin/format";

export const dynamic = "force-dynamic";

export default async function AdminReturnsPage() {
  const rows = await prisma.returnRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { order: { select: { orderNumber: true } }, items: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Returns</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/15 text-left dark:border-white/20">
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
            <tr key={r.id} className="border-b border-black/10 dark:border-white/10">
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
              <td className="py-2 text-xs text-black/50">{ts(r.createdAt)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-black/45">
                No returns yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";

import { prisma } from "@/lib/db";
import { money, Pill, ts } from "@/features/admin/format";
import { Poll } from "@/features/admin/poll";
import { listOrders, orderStatusCounts } from "@/server/admin";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "NEEDS_REVIEW",
  "CANCELLED",
  "COMPLETED",
];

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filter = {
    q: sp.q,
    orderStatus: sp.orderStatus,
    fulfillmentStatus: sp.fulfillmentStatus,
    paymentMethod: sp.paymentMethod,
    cursor: sp.cursor,
    limit: 25,
  };
  const [page, counts] = await Promise.all([
    listOrders(prisma, filter),
    orderStatusCounts(prisma),
  ]);

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over, cursor: undefined })) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders</h1>
        <Poll />
      </div>

      <form className="flex flex-wrap items-center gap-2 text-xs">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="order # / phone / email"
          className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
        />
        <select
          name="orderStatus"
          defaultValue={sp.orderStatus ?? ""}
          className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
        >
          <option value="">any status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")} ({counts[s] ?? 0})
            </option>
          ))}
        </select>
        <select
          name="paymentMethod"
          defaultValue={sp.paymentMethod ?? ""}
          className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
        >
          <option value="">any method</option>
          <option value="PREPAID_RAZORPAY">Prepaid</option>
          <option value="COD">COD</option>
        </select>
        <button className="rounded bg-foreground px-3 py-1 font-semibold text-background">
          Filter
        </button>
        {(sp.q || sp.orderStatus || sp.paymentMethod || sp.fulfillmentStatus) && (
          <Link href="/admin/orders" className="underline">
            clear
          </Link>
        )}
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/15 text-left dark:border-white/20">
            <th className="py-2 font-medium">Order</th>
            <th className="py-2 font-medium">Placed</th>
            <th className="py-2 font-medium">Contact</th>
            <th className="py-2 font-medium">Order</th>
            <th className="py-2 font-medium">Payment</th>
            <th className="py-2 font-medium">Fulfilment</th>
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {page.rows.map((r) => (
            <tr key={r.id} className="border-b border-black/10 dark:border-white/10">
              <td className="py-2">
                <Link
                  href={`/admin/orders/${r.orderNumber}`}
                  className="font-medium hover:underline"
                >
                  {r.orderNumber}
                </Link>
                <span className="ml-1 text-[11px] text-black/40 dark:text-white/40">
                  {r.paymentMethod === "COD" ? "COD" : "prepaid"}
                </span>
              </td>
              <td className="py-2 text-xs text-black/55 dark:text-white/55">
                {ts(r.placedAt ?? r.createdAt)}
              </td>
              <td className="py-2 text-xs">
                {r.contactPhone}
                {r.contactEmail ? <span className="block text-black/45">{r.contactEmail}</span> : null}
              </td>
              <td className="py-2">
                <Pill value={r.orderStatus} />
              </td>
              <td className="py-2">
                <Pill value={r.paymentStatus} />
              </td>
              <td className="py-2">
                <Pill value={r.fulfillmentStatus} />
              </td>
              <td className="py-2 text-right">{money(r.totalPaise)}</td>
            </tr>
          ))}
          {page.rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-black/45">
                No orders match.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex justify-end text-xs">
        {page.nextCursor ? (
          <Link
            href={`/admin/orders${qs({})}${qs({}) ? "&" : "?"}cursor=${encodeURIComponent(page.nextCursor)}`}
            className="rounded border border-black/15 px-3 py-1 dark:border-white/20"
          >
            Next page →
          </Link>
        ) : (
          <span className="text-black/40">end</span>
        )}
      </div>
    </div>
  );
}

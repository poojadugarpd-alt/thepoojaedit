import Link from "next/link";

import { prisma } from "@/lib/db";
import { ActionForm } from "@/features/admin/action-form";
import { money, Pill, ts } from "@/features/admin/format";
import { Poll } from "@/features/admin/poll";
import { Sheet } from "@/features/admin/sheet";
import { timed } from "@/lib/perf";
import { listOrders, orderStatusCounts } from "@/server/admin";

import { checkServiceabilityAction } from "./actions";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "NEEDS_REVIEW",
  "CANCELLED",
  "COMPLETED",
];

const FULFILMENT_STATUSES = ["UNFULFILLED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "NDR", "RTO_IN_TRANSIT"];

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
  const [page, counts] = await timed("admin:orders-list", () =>
    Promise.all([listOrders(prisma, filter), orderStatusCounts(prisma)]),
  );

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over, cursor: undefined })) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  const activeFilterCount = [sp.orderStatus, sp.paymentMethod, sp.fulfillmentStatus].filter(
    Boolean,
  ).length;

  const filterFields = (
    <form method="get" className="flex flex-col gap-3 text-sm">
      {sp.q && <input type="hidden" name="q" value={sp.q} />}
      <label className="flex flex-col gap-1">
        <span className="u-label u-label--muted">Order status</span>
        <select
          name="orderStatus"
          defaultValue={sp.orderStatus ?? ""}
          className="min-h-11 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
        >
          <option value="">any status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")} ({counts[s] ?? 0})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="u-label u-label--muted">Payment method</span>
        <select
          name="paymentMethod"
          defaultValue={sp.paymentMethod ?? ""}
          className="min-h-11 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
        >
          <option value="">any method</option>
          <option value="PREPAID_RAZORPAY">Prepaid</option>
          <option value="COD">COD</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="u-label u-label--muted">Fulfilment status</span>
        <select
          name="fulfillmentStatus"
          defaultValue={sp.fulfillmentStatus ?? ""}
          className="min-h-11 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
        >
          <option value="">any fulfilment status</option>
          {FULFILMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <button className="min-h-11 flex-1 rounded bg-foreground px-3 font-semibold text-background">
          Apply filters
        </button>
        {activeFilterCount > 0 && (
          <Link
            href="/admin/orders"
            className="flex min-h-11 items-center px-3 text-ink-soft underline"
          >
            Clear
          </Link>
        )}
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-strong">Orders</h1>
        <Poll />
      </div>

      {/* Serviceability checker (decision #2) — read-only, no order touched. */}
      <details className="rounded border border-line p-3 text-sm">
        <summary className="cursor-pointer font-medium text-ink-strong">
          Check a PIN code
        </summary>
        <ActionForm action={checkServiceabilityAction} submitLabel="Check" compact>
          <input
            name="postcode"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="6-digit PIN code"
            className="min-h-11 w-full rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
          />
        </ActionForm>
      </details>

      {/* Two independent forms (not nested) so the filter sheet's <form> is
          never a descendant of the search <form> — nesting forms is invalid
          HTML and browsers silently mis-handle it. */}
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex min-w-0 flex-1 items-center gap-2">
          {sp.orderStatus && <input type="hidden" name="orderStatus" value={sp.orderStatus} />}
          {sp.paymentMethod && (
            <input type="hidden" name="paymentMethod" value={sp.paymentMethod} />
          )}
          {sp.fulfillmentStatus && (
            <input type="hidden" name="fulfillmentStatus" value={sp.fulfillmentStatus} />
          )}
          <input
            name="q"
            aria-label="Search orders by number, phone or email"
            defaultValue={sp.q}
            placeholder="order # / phone / email"
            className="min-h-11 min-w-0 flex-1 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
          />
          <button className="min-h-11 rounded bg-foreground px-3 text-sm font-semibold text-background sm:hidden">
            Search
          </button>
          <button className="hidden min-h-11 rounded border border-line px-3 text-sm sm:block">
            Search
          </button>
        </form>

        {/* Desktop: inline filter form. Mobile: same fields, inside a sheet. */}
        <div className="hidden sm:block">{filterFields}</div>
        <Sheet
          title="Filter orders"
          trigger={`Filters${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
        >
          {filterFields}
        </Sheet>
      </div>

      {/* Mobile: card list */}
      <ul className="space-y-2 sm:hidden">
        {page.rows.map((r) => (
          <li key={r.id} className="rounded border border-line p-3">
            <Link href={`/admin/orders/${r.orderNumber}`} className="block">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-strong">{r.orderNumber}</span>
                <span className="text-sm font-medium text-ink-strong">
                  {money(r.totalPaise)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                {ts(r.placedAt ?? r.createdAt)} · {r.paymentMethod === "COD" ? "COD" : "prepaid"}
              </p>
              <p className="text-xs text-ink-soft">
                {r.contactPhone}
                {r.contactEmail ? ` · ${r.contactEmail}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Pill value={r.orderStatus} />
                <Pill value={r.paymentStatus} />
                <Pill value={r.fulfillmentStatus} />
              </div>
            </Link>
          </li>
        ))}
        {page.rows.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-soft">No orders match.</li>
        )}
      </ul>

      {/* Desktop: table */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-line text-left">
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
            <tr key={r.id} className="border-b border-line/60">
              <td className="py-2">
                <Link
                  href={`/admin/orders/${r.orderNumber}`}
                  className="font-medium hover:underline"
                >
                  {r.orderNumber}
                </Link>
                <span className="ml-1 text-[11px] text-ink-soft">
                  {r.paymentMethod === "COD" ? "COD" : "prepaid"}
                </span>
              </td>
              <td className="py-2 text-xs text-ink-soft">{ts(r.placedAt ?? r.createdAt)}</td>
              <td className="py-2 text-xs">
                {r.contactPhone}
                {r.contactEmail ? <span className="block text-ink-soft">{r.contactEmail}</span> : null}
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
              <td colSpan={7} className="py-6 text-center text-ink-soft">
                No orders match.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex justify-end text-sm">
        {page.nextCursor ? (
          <Link
            href={`/admin/orders${qs({})}${qs({}) ? "&" : "?"}cursor=${encodeURIComponent(page.nextCursor)}`}
            className="flex min-h-11 items-center rounded border border-line px-3"
          >
            Load more
          </Link>
        ) : (
          <span className="text-ink-soft">end</span>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";

import { prisma } from "@/lib/db";
import { ts } from "@/features/admin/format";
import { searchCustomers } from "@/server/admin";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const rows = await searchCustomers(prisma, { q, limit: 50 });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink-strong">Customers</h1>
      <p className="text-xs text-ink-soft">
        A contact match is not proof of ownership — guest orders are never merged on
        a matching email or phone.
      </p>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="name / email / phone"
          className="min-h-11 min-w-0 flex-1 rounded border border-line bg-transparent px-2 py-1 text-base sm:max-w-xs sm:text-sm"
        />
        <button className="min-h-11 rounded bg-foreground px-3 text-sm font-semibold text-background">
          Search
        </button>
      </form>

      {/* Mobile: card list */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((c) => (
          <li key={c.id} className="rounded border border-line p-3">
            <Link href={`/admin/customers/${c.id}`} className="block">
              <p className="font-medium text-ink-strong">{c.name ?? "—"}</p>
              <p className="text-xs text-ink-soft">
                {c.email ?? "—"} · {c.phone ?? "—"}
              </p>
              <p className="mt-1 text-xs text-ink">
                {c.orders} order{c.orders === 1 ? "" : "s"} · joined {ts(c.createdAt)}
              </p>
            </Link>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-soft">No customers.</li>
        )}
      </ul>

      {/* Desktop: table */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Email</th>
            <th className="py-2 font-medium">Phone</th>
            <th className="py-2 font-medium">Orders</th>
            <th className="py-2 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-line/60">
              <td className="py-2">
                <Link href={`/admin/customers/${c.id}`} className="hover:underline">
                  {c.name ?? "—"}
                </Link>
              </td>
              <td className="py-2 text-xs">{c.email ?? "—"}</td>
              <td className="py-2 text-xs">{c.phone ?? "—"}</td>
              <td className="py-2">{c.orders}</td>
              <td className="py-2 text-xs text-ink-soft">{ts(c.createdAt)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-ink-soft">
                No customers.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

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
      <h1 className="text-xl font-semibold">Customers</h1>
      <p className="text-xs text-black/50 dark:text-white/50">
        A contact match is not proof of ownership — guest orders are never merged on
        a matching email or phone.
      </p>
      <form className="text-xs">
        <input
          name="q"
          defaultValue={q}
          placeholder="name / email / phone"
          className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
        />
        <button className="ml-2 rounded bg-foreground px-3 py-1 font-semibold text-background">
          Search
        </button>
      </form>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/15 text-left dark:border-white/20">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Email</th>
            <th className="py-2 font-medium">Phone</th>
            <th className="py-2 font-medium">Orders</th>
            <th className="py-2 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-black/10 dark:border-white/10">
              <td className="py-2">
                <Link href={`/admin/customers/${c.id}`} className="hover:underline">
                  {c.name ?? "—"}
                </Link>
              </td>
              <td className="py-2 text-xs">{c.email ?? "—"}</td>
              <td className="py-2 text-xs">{c.phone ?? "—"}</td>
              <td className="py-2">{c.orders}</td>
              <td className="py-2 text-xs text-black/50">{ts(c.createdAt)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-black/45">
                No customers.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

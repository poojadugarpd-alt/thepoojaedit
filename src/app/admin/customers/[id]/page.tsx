import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { ActionForm } from "@/features/admin/action-form";
import { money, Pill, ts } from "@/features/admin/format";
import { getCustomerDetail } from "@/server/admin";

import { addCustomerNoteAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCustomerDetail(prisma, id);
  if (!c) notFound();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{c.name ?? "Customer"}</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        {c.email ?? "no email"} · {c.phone ?? "no phone"} · joined {ts(c.createdAt)} ·
        transactional consent: {String(c.transactionalConsent)}
      </p>

      <section className="rounded border border-black/10 p-3 dark:border-white/15">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50">
          Orders
        </h2>
        <ul className="space-y-1 text-sm">
          {c.orders.map((o) => (
            <li key={o.orderNumber}>
              <Link href={`/admin/orders/${o.orderNumber}`} className="hover:underline">
                {o.orderNumber}
              </Link>{" "}
              <Pill value={o.orderStatus} /> <Pill value={o.paymentStatus} /> ·{" "}
              {money(o.totalPaise)} · {ts(o.createdAt)}
            </li>
          ))}
          {c.orders.length === 0 && <li className="text-xs text-black/45">none</li>}
        </ul>
      </section>

      <section className="rounded border border-black/10 p-3 dark:border-white/15">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50">
          Private notes
        </h2>
        <ul className="mb-3 space-y-1 text-xs">
          {c.notes.map((n) => (
            <li key={n.id}>
              <span className="text-black/45">
                {ts(n.createdAt)} · {n.author.email}
              </span>{" "}
              — {n.body}
            </li>
          ))}
          {c.notes.length === 0 && <li className="text-black/45">none</li>}
        </ul>
        <ActionForm action={addCustomerNoteAction} submitLabel="Add note" compact>
          <input type="hidden" name="customerId" value={c.id} />
          <textarea
            name="body"
            rows={2}
            className="w-full rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
          />
        </ActionForm>
      </section>
    </div>
  );
}

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
      <h1 className="text-xl font-semibold text-ink-strong">{c.name ?? "Customer"}</h1>
      <p className="text-sm text-ink-soft">
        {c.email ?? "no email"} · {c.phone ?? "no phone"} · joined {ts(c.createdAt)} ·
        transactional consent: {String(c.transactionalConsent)}
      </p>

      <section className="rounded border border-line p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Orders
        </h2>
        <ul className="space-y-2 text-sm">
          {c.orders.map((o) => (
            <li key={o.orderNumber}>
              <Link
                href={`/admin/orders/${o.orderNumber}`}
                className="flex min-h-11 flex-wrap items-center gap-1.5 py-1"
              >
                <span className="font-medium text-ink-strong hover:underline">
                  {o.orderNumber}
                </span>
                <Pill value={o.orderStatus} />
                <Pill value={o.paymentStatus} />
                <span className="text-ink-soft">
                  · {money(o.totalPaise)} · {ts(o.createdAt)}
                </span>
              </Link>
            </li>
          ))}
          {c.orders.length === 0 && <li className="text-xs text-ink-soft">none</li>}
        </ul>
      </section>

      <section className="rounded border border-line p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Private notes
        </h2>
        <ul className="mb-3 space-y-1 text-xs">
          {c.notes.map((n) => (
            <li key={n.id} className="text-ink">
              <span className="text-ink-soft">
                {ts(n.createdAt)} · {n.author.email}
              </span>{" "}
              — {n.body}
            </li>
          ))}
          {c.notes.length === 0 && <li className="text-ink-soft">none</li>}
        </ul>
        <ActionForm action={addCustomerNoteAction} submitLabel="Add note" compact>
          <input type="hidden" name="customerId" value={c.id} />
          <textarea
            name="body"
            rows={2}
            className="w-full rounded border border-line bg-transparent px-2 py-1 text-base sm:text-xs"
          />
        </ActionForm>
      </section>
    </div>
  );
}

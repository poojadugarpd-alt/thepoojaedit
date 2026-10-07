import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/features/admin/action-form";
import { prisma } from "@/lib/db";
import { formatPaiseINR } from "@/lib/money";
import { requireAdmin } from "@/server/auth/require-admin";
import { countActiveUses } from "@/server/discounts";
import { getCheckoutRules } from "@/server/settings";

import { deleteDiscountAction, updateDiscountAction } from "../actions";
import { DiscountFields } from "../discount-fields";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discount code" };

export default async function AdminDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const code = await prisma.discountCode.findUnique({ where: { id } });
  if (!code) notFound();
  const rules = await getCheckoutRules(prisma);
  const [uses, recent] = await Promise.all([
    countActiveUses(prisma, id, {
      now: new Date(),
      ttlSeconds: rules.reservationTtlSeconds,
    }),
    prisma.discountRedemption.findMany({
      where: { discountCodeId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { order: { select: { orderNumber: true, orderStatus: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/discounts" className="text-xs text-ink-soft">
          ← Discount codes
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-[0.04em] text-ink-strong">
          {code.code}
        </h1>
        <p className="text-xs text-ink-soft">
          Used {uses}
          {code.maxRedemptions != null ? ` of ${code.maxRedemptions}` : ""} times
          (cancelled and unpaid-abandoned orders don&rsquo;t count).
        </p>
      </div>

      <section className="rounded-[10px] border border-line p-4">
        <ActionForm action={updateDiscountAction.bind(null, id)} submitLabel="Save">
          <DiscountFields code={code} />
        </ActionForm>
      </section>

      {recent.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
            Orders
          </h2>
          <ul className="divide-y divide-line rounded-[10px] border border-line text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2">
                <Link
                  href={`/admin/orders/${r.order.orderNumber}`}
                  className="underline"
                >
                  {r.order.orderNumber}
                </Link>
                <span className="text-xs text-ink-soft">
                  −{formatPaiseINR(r.amountPaise)}
                  {r.releasedAt || r.order.orderStatus === "CANCELLED"
                    ? " · cancelled"
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="space-y-2">
          <p className="text-xs text-ink-soft">
            Not used yet, so it can be deleted. (A used code can only be switched off.)
          </p>
          <ActionForm
            action={deleteDiscountAction.bind(null, id)}
            submitLabel="Delete code"
          >
            {null}
          </ActionForm>
        </section>
      )}
    </div>
  );
}

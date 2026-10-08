import Link from "next/link";

import { ActionForm } from "@/features/admin/action-form";
import { prisma } from "@/lib/db";
import { formatPaiseINR } from "@/lib/money";
import { requireAdmin } from "@/server/auth/require-admin";
import { listCodesWithUses } from "@/server/discounts";
import { getCheckoutRules } from "@/server/settings";

import { createDiscountAction } from "./actions";
import { DiscountFields } from "./discount-fields";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discount codes" };

const SCOPE = {
  ALL: "Everything",
  LABEL: "The Label",
  CLOSET: "Pooja’s Closet",
} as const;

export default async function AdminDiscountsPage() {
  await requireAdmin();
  const rules = await getCheckoutRules(prisma);
  const now = new Date();
  const codes = await listCodesWithUses(prisma, {
    now,
    ttlSeconds: rules.reservationTtlSeconds,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-ink-strong">Discount codes</h1>

      <section className="space-y-2">
        {codes.length > 0 ? (
          <ul className="divide-y divide-line rounded-[10px] border border-line">
            {codes.map((c) => {
              const expired = c.endsAt != null && c.endsAt <= now;
              const usedUp = c.maxRedemptions != null && c.uses >= c.maxRedemptions;
              const state = !c.isActive
                ? "Off"
                : expired
                  ? "Expired"
                  : usedUp
                    ? "Used up"
                    : "Active";
              return (
                <li key={c.id}>
                  <Link
                    href={`/admin/discounts/${c.id}`}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
                  >
                    <span>
                      <span className="block text-sm font-medium tracking-[0.04em] text-ink-strong">
                        {c.code}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {c.kind === "PERCENT"
                          ? `${(c.percentBps ?? 0) / 100}% off`
                          : `${formatPaiseINR(c.amountPaise ?? 0)} off`}{" "}
                        · {SCOPE[c.appliesTo]} · used {c.uses}
                        {c.maxRedemptions != null ? ` of ${c.maxRedemptions}` : ""}
                      </span>
                    </span>
                    <span
                      className={`text-xs font-medium ${state === "Active" ? "text-ok" : "text-ink-soft"}`}
                    >
                      {state}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">No codes yet.</p>
        )}
      </section>

      <section className="space-y-3 rounded-[10px] border border-line p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          New code
        </h2>
        <ActionForm
          action={createDiscountAction}
          submitLabel="Create code"
          reloadOnSuccess
        >
          <DiscountFields />
        </ActionForm>
      </section>
    </div>
  );
}

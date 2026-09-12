import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { ActionForm } from "@/features/admin/action-form";
import { money, Pill, ts } from "@/features/admin/format";

import {
  decideReturnAction,
  finalizeInspectionAction,
  inspectItemAction,
  markReceivedAction,
  resolveReturnAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminReturnDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rr = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      order: { select: { orderNumber: true } },
      items: { include: { orderItem: true } },
    },
  });
  if (!rr) notFound();
  const hid = <input type="hidden" name="returnRequestId" value={rr.id} />;
  const allInspected = rr.items.every((i) => i.inspectionOutcome !== "PENDING");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-ink-strong">
          Return {rr.id.slice(0, 8)}
        </h1>
        <Pill value={rr.status} />
        {rr.resolution && <Pill value={rr.resolution} />}
        <Link
          href={`/admin/orders/${rr.order.orderNumber}`}
          className="flex min-h-11 items-center text-xs underline"
        >
          {rr.order.orderNumber}
        </Link>
      </div>
      <p className="text-sm text-ink">
        Reason: {rr.reason}
        {rr.adminNotes ? ` · notes: ${rr.adminNotes}` : ""} · created {ts(rr.createdAt)}
      </p>

      {/* Mobile: workflow first — the reason staff opened this record. */}
      <section className="order-first rounded border border-line p-3 sm:order-none">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Workflow
        </h2>
        <div className="space-y-3">
          {rr.status === "REQUESTED" && (
            <ActionForm action={decideReturnAction} submitLabel="Decide">
              {hid}
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  aria-label="Return decision"
                  name="decision"
                  className="min-h-11 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
                >
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                </select>
                <input
                  name="notes"
                  placeholder="notes / reason"
                  className="min-h-11 flex-1 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
                />
              </div>
            </ActionForm>
          )}
          {["APPROVED", "IN_TRANSIT"].includes(rr.status) && (
            <ActionForm action={markReceivedAction} submitLabel="Mark received">
              {hid}
            </ActionForm>
          )}
          {rr.status === "RECEIVED" && allInspected && (
            <ActionForm action={finalizeInspectionAction} submitLabel="Finalise inspection">
              {hid}
            </ActionForm>
          )}
          {rr.status === "INSPECTED" && (
            <ActionForm action={resolveReturnAction} submitLabel="Resolve">
              {hid}
              <select
                aria-label="Return resolution"
                name="resolution"
                className="min-h-11 w-full rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm sm:w-auto"
              >
                <option value="REFUND">Refund (line value)</option>
                <option value="REPLACEMENT">Replacement</option>
                <option value="REJECTED">Reject</option>
              </select>
            </ActionForm>
          )}
          {!["REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED", "INSPECTED"].includes(
            rr.status,
          ) && <p className="text-sm text-ink-soft">No action pending — {rr.status.toLowerCase()}.</p>}
        </div>
      </section>

      <section className="rounded border border-line p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Items
        </h2>
        <ul className="space-y-3 text-sm">
          {rr.items.map((it) => (
            <li key={it.id} className="border-b border-line/60 pb-3">
              <p>
                {it.orderItem.title} · qty {it.quantity} ·{" "}
                {money(
                  Math.round(it.orderItem.totalPaise / Math.max(1, it.orderItem.quantity)) *
                    it.quantity,
                )}
              </p>
              <p className="mt-1 flex items-center gap-2">
                <Pill value={it.inspectionOutcome} />
                {it.restockedAt ? (
                  <span className="text-xs text-ok">restocked</span>
                ) : null}
              </p>
              {rr.status === "RECEIVED" && it.inspectionOutcome === "PENDING" && (
                <ActionForm action={inspectItemAction} submitLabel="Record inspection" compact>
                  {hid}
                  <input type="hidden" name="returnItemId" value={it.id} />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      aria-label="Inspection outcome"
                      name="outcome"
                      className="min-h-11 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-xs"
                    >
                      <option value="RESTOCK">Restock (resellable)</option>
                      <option value="DAMAGED_DISCARD">Damaged — discard</option>
                    </select>
                    <input
                      name="conditionNotes"
                      placeholder="condition notes"
                      className="min-h-11 flex-1 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-xs"
                    />
                  </div>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

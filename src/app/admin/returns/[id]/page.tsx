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
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Return {rr.id.slice(0, 8)}</h1>
        <Pill value={rr.status} />
        {rr.resolution && <Pill value={rr.resolution} />}
        <Link href={`/admin/orders/${rr.order.orderNumber}`} className="text-xs underline">
          {rr.order.orderNumber}
        </Link>
      </div>
      <p className="text-sm text-black/60 dark:text-white/60">
        Reason: {rr.reason}
        {rr.adminNotes ? ` · notes: ${rr.adminNotes}` : ""} · created {ts(rr.createdAt)}
      </p>

      <section className="rounded border border-black/10 p-3 dark:border-white/15">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50">
          Items
        </h2>
        <ul className="space-y-3 text-sm">
          {rr.items.map((it) => (
            <li key={it.id} className="border-b border-black/10 pb-3 dark:border-white/10">
              <p>
                {it.orderItem.title} · qty {it.quantity} ·{" "}
                {money(Math.round(it.orderItem.totalPaise / Math.max(1, it.orderItem.quantity)) * it.quantity)}{" "}
                <Pill value={it.inspectionOutcome} />
                {it.restockedAt ? " · restocked" : ""}
              </p>
              {rr.status === "RECEIVED" && it.inspectionOutcome === "PENDING" && (
                <ActionForm action={inspectItemAction} submitLabel="Record inspection" compact>
                  {hid}
                  <input type="hidden" name="returnItemId" value={it.id} />
                  <div className="flex gap-2">
                    <select
                      name="outcome"
                      className="rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
                    >
                      <option value="RESTOCK">Restock (resellable)</option>
                      <option value="DAMAGED_DISCARD">Damaged — discard</option>
                    </select>
                    <input
                      name="conditionNotes"
                      placeholder="condition notes"
                      className="flex-1 rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
                    />
                  </div>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border border-black/10 p-3 dark:border-white/15">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50">
          Workflow
        </h2>
        <div className="space-y-3">
          {rr.status === "REQUESTED" && (
            <ActionForm action={decideReturnAction} submitLabel="Decide" compact>
              {hid}
              <div className="flex gap-2">
                <select
                  name="decision"
                  className="rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
                >
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                </select>
                <input
                  name="notes"
                  placeholder="notes / reason"
                  className="flex-1 rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
                />
              </div>
            </ActionForm>
          )}
          {["APPROVED", "IN_TRANSIT"].includes(rr.status) && (
            <ActionForm action={markReceivedAction} submitLabel="Mark received" compact>
              {hid}
            </ActionForm>
          )}
          {rr.status === "RECEIVED" && allInspected && (
            <ActionForm action={finalizeInspectionAction} submitLabel="Finalise inspection" compact>
              {hid}
            </ActionForm>
          )}
          {rr.status === "INSPECTED" && (
            <ActionForm action={resolveReturnAction} submitLabel="Resolve" compact>
              {hid}
              <select
                name="resolution"
                className="rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
              >
                <option value="REFUND">Refund (line value)</option>
                <option value="REPLACEMENT">Replacement</option>
                <option value="REJECTED">Reject</option>
              </select>
            </ActionForm>
          )}
        </div>
      </section>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { ActionForm } from "@/features/admin/action-form";
import { money, Pill, ts } from "@/features/admin/format";
import { getAdminOrder, listActivity } from "@/server/admin";
import { isShippingConfigured } from "@/server/shipping";

import {
  addOrderNoteAction,
  cancelOrderAction,
  confirmCodAction,
  createShipmentAction,
  generateInvoiceAction,
  reconcileShipmentAction,
  refundOrderAction,
  syncCodRemittanceAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await getAdminOrder(prisma, orderNumber);
  if (!order) notFound();

  const activity = await listActivity(prisma, {
    entityType: "Order",
    entityId: order.id,
    limit: 20,
  });
  const shipment = order.shipments[0];
  const hidden = <input type="hidden" name="orderNumber" value={order.orderNumber} />;
  const capturedPaise = order.paymentAttempts
    .filter((a) => a.status === "CAPTURED")
    .reduce((s, a) => s + a.amountPaise, 0);
  const refundedPaise = order.refunds
    .filter((r) => r.status === "COMPLETED")
    .reduce((s, r) => s + r.amountPaise, 0);
  const refundable = order.paymentMethod === "COD" ? 0 : capturedPaise - refundedPaise;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Order {order.orderNumber}</h1>
        <Pill value={order.orderStatus} />
        <Pill value={order.paymentStatus} />
        <Pill value={order.fulfillmentStatus} />
        <span className="text-xs text-black/45 dark:text-white/45">
          {order.paymentMethod === "COD" ? "Cash on delivery" : "Prepaid"} · placed{" "}
          {ts(order.placedAt)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* left: facts */}
        <div className="space-y-6 lg:col-span-2">
          <Section title="Items">
            <table className="w-full text-sm">
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className="border-b border-black/10 dark:border-white/10">
                    <td className="py-1.5">
                      {i.title}
                      {i.size ? ` · ${i.size}` : ""}
                      <span className="block text-[11px] text-black/45">
                        {CATALOG_LABEL[i.catalog]} · {i.sku} · qty {i.quantity}
                      </span>
                    </td>
                    <td className="py-1.5 text-right">{money(i.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-2 ml-auto max-w-xs space-y-0.5 text-sm">
              <Row k="Subtotal" v={money(order.subtotalPaise)} />
              {order.discountPaise > 0 && <Row k="Discount" v={`-${money(order.discountPaise)}`} />}
              <Row k="Shipping" v={money(order.shippingPaise)} />
              {order.codFeePaise > 0 && <Row k="COD fee" v={money(order.codFeePaise)} />}
              <Row k="Tax" v={money(order.taxPaise)} />
              <Row k="Total" v={money(order.totalPaise)} strong />
              {capturedPaise > 0 && <Row k="Captured" v={money(capturedPaise)} />}
              {refundedPaise > 0 && <Row k="Refunded" v={`-${money(refundedPaise)}`} />}
            </dl>
          </Section>

          <Section title="Timeline">
            <ol className="space-y-1.5 text-xs">
              {order.events.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="w-32 shrink-0 text-black/40 dark:text-white/40">
                    {ts(e.createdAt)}
                  </span>
                  <span>
                    <span className="font-medium">{e.type}</span>
                    {e.actor ? <span className="text-black/45"> · {e.actor}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Payments">
            {order.paymentAttempts.length === 0 ? (
              <p className="text-xs text-black/45">No prepaid attempts.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {order.paymentAttempts.map((a) => (
                    <tr key={a.id} className="border-b border-black/10 dark:border-white/10">
                      <td className="py-1">{a.provider}</td>
                      <td className="py-1">
                        <Pill value={a.status} />
                      </td>
                      <td className="py-1">{a.providerPaymentId ?? a.providerOrderId ?? "—"}</td>
                      <td className="py-1 text-right">{money(a.amountPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {shipment && (
            <Section title="Shipment">
              <dl className="text-xs">
                <Row k="Carrier" v={shipment.courier ?? "Shadowfax"} />
                <Row k="AWB" v={shipment.awb ?? "—"} />
                <Row k="Status" v={shipment.statusNormalized} />
                {shipment.trackingUrl && (
                  <Row
                    k="Track"
                    v={
                      <a href={shipment.trackingUrl} className="underline" target="_blank" rel="noreferrer">
                        carrier site
                      </a>
                    }
                  />
                )}
              </dl>
              <ol className="mt-2 space-y-0.5 text-[11px] text-black/55 dark:text-white/55">
                {shipment.events.slice(-8).map((ev) => (
                  <li key={ev.id}>
                    {(ev.statusNormalized ?? ev.statusRaw ?? "").replaceAll("_", " ")} —{" "}
                    {ts(ev.occurredAt)}
                  </li>
                ))}
              </ol>
              {shipment.codRemittances.length > 0 && (
                <p className="mt-2 text-[11px]">
                  COD:{" "}
                  {shipment.codRemittances.map((c) => (
                    <span key={c.id}>
                      <Pill value={c.status} /> expected {money(c.expectedPaise)} · collected{" "}
                      {money(c.collectedPaise ?? 0)} · remitted {money(c.remittedPaise ?? 0)}
                    </span>
                  ))}
                </p>
              )}
              <div className="mt-2 flex gap-3">
                <ActionForm action={reconcileShipmentAction} submitLabel="Reconcile tracking" compact>
                  {hidden}
                  <input type="hidden" name="shipmentId" value={shipment.id} />
                </ActionForm>
                {order.paymentMethod === "COD" && (
                  <ActionForm action={syncCodRemittanceAction} submitLabel="Sync COD remittance" compact>
                    {hidden}
                    <input type="hidden" name="shipmentId" value={shipment.id} />
                  </ActionForm>
                )}
                <a
                  href={`/admin/shipments/${shipment.id}/label`}
                  className="text-xs underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  label PDF
                </a>
              </div>
            </Section>
          )}

          {order.returnRequests.length > 0 && (
            <Section title="Returns">
              <ul className="space-y-1 text-xs">
                {order.returnRequests.map((rr) => (
                  <li key={rr.id}>
                    <Link href={`/admin/returns/${rr.id}`} className="underline">
                      {rr.id.slice(0, 8)}
                    </Link>{" "}
                    <Pill value={rr.status} /> — {rr.reason} · {rr.items.length} item(s)
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* right: guarded actions */}
        <div className="space-y-4">
          <Section title="Contact & address">
            <p className="text-xs">{order.contactPhone}</p>
            {order.contactEmail && <p className="text-xs text-black/50">{order.contactEmail}</p>}
            {order.addresses.map((a) => (
              <p key={a.id} className="mt-1 text-[11px] text-black/55 dark:text-white/55">
                <span className="font-medium">{a.type}</span> — {a.name}, {a.line1},{" "}
                {a.city}, {a.stateName} {a.postcode}
              </p>
            ))}
            {order.customer && (
              <p className="mt-1 text-[11px]">
                <Link href={`/admin/customers/${order.customer.id}`} className="underline">
                  customer record
                </Link>
              </p>
            )}
          </Section>

          <Section title="Actions">
            <div className="space-y-3">
              {order.orderStatus === "PENDING_CONFIRMATION" && order.paymentMethod === "COD" && (
                <ActionForm action={confirmCodAction} submitLabel="Confirm COD order" compact>
                  {hidden}
                </ActionForm>
              )}

              {["CONFIRMED"].includes(order.orderStatus) &&
                order.fulfillmentStatus === "UNFULFILLED" && (
                  <ActionForm action={createShipmentAction} submitLabel="Create shipment" compact>
                    {hidden}
                    {!isShippingConfigured() && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Shadowfax not configured in this environment.
                      </p>
                    )}
                  </ActionForm>
                )}

              {!order.invoices.length &&
                ["CONFIRMED", "COMPLETED"].includes(order.orderStatus) && (
                  <ActionForm action={generateInvoiceAction} submitLabel="Issue invoice" compact>
                    {hidden}
                  </ActionForm>
                )}
              {order.invoices.map((inv) => (
                <a
                  key={inv.id}
                  href={`/order/${order.orderNumber}/invoice`}
                  className="block text-xs underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  invoice {inv.financialYear}/{inv.number} PDF
                </a>
              ))}

              {refundable > 0 && (
                <ActionForm action={refundOrderAction} submitLabel="Refund" compact>
                  {hidden}
                  <p className="text-[11px] text-black/45">
                    up to {money(refundable)} refundable
                  </p>
                  <input
                    name="amountRupees"
                    type="number"
                    step="0.01"
                    placeholder="amount (₹)"
                    className="w-full rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
                  />
                  <input
                    name="reason"
                    placeholder="reason"
                    className="w-full rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
                  />
                </ActionForm>
              )}

              {!["CANCELLED", "COMPLETED"].includes(order.orderStatus) &&
                order.fulfillmentStatus === "UNFULFILLED" && (
                  <ActionForm action={cancelOrderAction} submitLabel="Cancel order" compact>
                    {hidden}
                    <input
                      name="reason"
                      placeholder="cancellation reason"
                      className="w-full rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
                    />
                  </ActionForm>
                )}
            </div>
          </Section>

          <Section title="Add a note">
            <ActionForm action={addOrderNoteAction} submitLabel="Add note" compact>
              {hidden}
              <textarea
                name="note"
                rows={2}
                className="w-full rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
              />
            </ActionForm>
          </Section>

          <Section title="Admin activity">
            <ul className="space-y-0.5 text-[11px] text-black/55 dark:text-white/55">
              {activity.map((a) => (
                <li key={a.id}>
                  {a.action} · {a.adminUser.email} · {ts(a.createdAt)}
                  {a.reason ? ` — ${a.reason}` : ""}
                </li>
              ))}
              {activity.length === 0 && <li>none</li>}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-black/10 p-3 dark:border-white/15">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-black/15 pt-1 font-semibold dark:border-white/20" : ""}`}>
      <dt className="text-black/55 dark:text-white/55">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

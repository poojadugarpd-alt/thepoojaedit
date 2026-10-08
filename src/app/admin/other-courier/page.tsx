import Link from "next/link";

import { ActionForm, Field } from "@/features/admin/action-form";
import { money, ts } from "@/features/admin/format";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import { DEFAULT_OTHER_COURIER, listOtherCourierWork } from "@/server/shipping";

import { linkShipmentAction, setManualShipmentStatusAction } from "../orders/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Other courier" };

/**
 * Orders Shadowfax couldn't take (D-153). Book the parcel on the courier's own
 * site (Delhivery by default), enter the AWB here, and the customer is emailed
 * the AWB with the courier's tracking link. No courier API: status is set here.
 */
export default async function OtherCourierPage() {
  await requireAdmin();
  const { waiting, sent } = await listOtherCourierWork(prisma);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink-strong">Other courier</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Paid orders Shadowfax couldn&apos;t book. Book each one on{" "}
          {DEFAULT_OTHER_COURIER}, then enter its AWB below — the customer gets an email
          with the AWB and a {DEFAULT_OTHER_COURIER} tracking link.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Waiting for an AWB ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing waiting.</p>
        ) : (
          <ul className="space-y-4">
            {waiting.map((o) => {
              const a = o.addresses[0];
              return (
                <li key={o.id} className="rounded-[10px] border border-line p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`/admin/orders/${o.orderNumber}`}
                      className="text-sm font-medium text-ink-strong underline"
                    >
                      {o.orderNumber}
                    </Link>
                    <span className="text-xs text-ink-soft">
                      {ts(o.placedAt)} · {money(o.totalPaise)} ·{" "}
                      {o.paymentMethod === "COD" ? "COD" : "Prepaid"}
                    </span>
                  </div>
                  {a && (
                    <p className="mt-1 text-xs text-ink-soft">
                      {a.name}, {a.phone} — {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.stateName}{" "}
                      <strong className="text-ink-strong">{a.postcode}</strong>
                    </p>
                  )}
                  {o.reason && <p className="mt-1 text-[11px] text-wait">{o.reason}</p>}
                  <ActionForm
                    action={linkShipmentAction}
                    submitLabel="Save AWB & email customer"
                    className="mt-3"
                  >
                    <input type="hidden" name="orderNumber" value={o.orderNumber} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Courier"
                        name="courier"
                        defaultValue={DEFAULT_OTHER_COURIER}
                        required
                        maxLength={40}
                      />
                      <Field label="AWB" name="awb" required maxLength={40} />
                    </div>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Sent with another courier ({sent.length})
        </h2>
        {sent.length === 0 ? (
          <p className="text-sm text-ink-soft">None in transit.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[10px] border border-line">
            {sent.map((o) => {
              const s = o.shipments[0];
              const a = o.addresses[0];
              return (
                <li key={o.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`/admin/orders/${o.orderNumber}`}
                      className="text-sm font-medium text-ink-strong underline"
                    >
                      {o.orderNumber}
                    </Link>
                    <span className="text-xs text-ink-soft">
                      {s?.courier} · AWB {s?.awb} · {s?.statusNormalized}
                    </span>
                  </div>
                  {a && (
                    <p className="text-xs text-ink-soft">
                      {a.name}, {a.city} {a.postcode}
                      {s?.trackingUrl && (
                        <>
                          {" · "}
                          <a
                            href={s.trackingUrl}
                            className="underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            track
                          </a>
                        </>
                      )}
                    </p>
                  )}
                  {s && (
                    <div className="flex flex-wrap gap-3">
                      {s.statusNormalized === "PROCESSING" && (
                        <ActionForm
                          action={setManualShipmentStatusAction}
                          submitLabel="Mark shipped"
                          compact
                        >
                          <input
                            type="hidden"
                            name="orderNumber"
                            value={o.orderNumber}
                          />
                          <input type="hidden" name="shipmentId" value={s.id} />
                          <input type="hidden" name="status" value="SHIPPED" />
                        </ActionForm>
                      )}
                      <ActionForm
                        action={setManualShipmentStatusAction}
                        submitLabel="Mark delivered"
                        compact
                      >
                        <input type="hidden" name="orderNumber" value={o.orderNumber} />
                        <input type="hidden" name="shipmentId" value={s.id} />
                        <input type="hidden" name="status" value="DELIVERED" />
                      </ActionForm>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

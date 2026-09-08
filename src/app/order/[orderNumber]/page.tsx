import type { Metadata } from "next";
import Link from "next/link";

import { formatPaiseINR } from "@/lib/money";
import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { ResumePayment } from "@/features/checkout/resume-payment";
import { getCurrentCustomer } from "@/server/auth/current-customer";
import { ResourceNotFoundError } from "@/server/auth/errors";
import { getViewableOrderForCustomer, getViewableOrderForGuest } from "@/server/orders";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string; placed?: string; review?: string }>;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

export default async function OrderPage({ params, searchParams }: Params) {
  const { orderNumber } = await params;
  const { token, placed, review } = await searchParams;

  let order: Awaited<ReturnType<typeof getViewableOrderForGuest>> | null = null;
  try {
    if (token) {
      order = await getViewableOrderForGuest(orderNumber, token);
    } else {
      const customer = await getCurrentCustomer();
      if (customer) order = await getViewableOrderForCustomer(orderNumber, customer.id);
    }
  } catch (e) {
    if (!(e instanceof ResourceNotFoundError)) throw e;
  }

  if (!order) {
    return (
      <div className="u-page max-w-lg py-24">
        <h1 className="u-h2">Order not found</h1>
        <p className="u-lead mt-4">
          We couldn&rsquo;t find that order, or the link has expired. Check the link in
          your confirmation, or sign in to your account.
        </p>
        <Link href="/" className="u-textlink mt-6">
          Back to shop
        </Link>
      </div>
    );
  }

  const shipping = order.addresses.find((a) => a.type === "SHIPPING");

  const awaitingPrepaid =
    order.paymentMethod === "PREPAID_RAZORPAY" &&
    order.orderStatus === "PENDING_PAYMENT";

  const billing = order.addresses.find((a) => a.type === "BILLING");

  const banner = review
    ? "We've received your payment and are reviewing this order. We'll email you shortly — no action needed."
    : placed && order.paymentMethod === "COD"
      ? "Order placed. It's pending confirmation — we'll message you to confirm your cash-on-delivery order."
      : placed && !awaitingPrepaid
        ? "Payment received — your order is confirmed."
        : null;

  return (
    <div className="u-page max-w-2xl py-14 sm:py-20">
      <h1 className="u-h2">Order {order.orderNumber}</h1>

      {banner && (
        <p
          role="status"
          className="mt-4 rounded-[10px] border border-line bg-fill px-4 py-3 text-sm text-ink-strong"
        >
          {banner}
        </p>
      )}

      {awaitingPrepaid && (
        <ResumePayment
          orderNumber={order.orderNumber}
          token={token ?? null}
          name={billing?.name}
          email={order.contactEmail}
          phone={order.contactPhone}
        />
      )}
      <p className="mt-2 text-sm text-ink-soft">
        Placed{" "}
        {order.placedAt ? new Date(order.placedAt).toLocaleDateString("en-IN") : "—"}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[10px] border border-line p-5 text-sm">
          <p className="u-label">Status</p>
          <div className="mt-2">
            <Row label="Order" value={order.orderStatus.replaceAll("_", " ")} />
            <Row label="Payment" value={order.paymentStatus.replaceAll("_", " ")} />
            <Row
              label="Fulfilment"
              value={order.fulfillmentStatus.replaceAll("_", " ")}
            />
            <Row
              label="Method"
              value={order.paymentMethod === "COD" ? "Cash on delivery" : "Prepaid"}
            />
          </div>
        </div>
        {shipping && (
          <div className="rounded-[10px] border border-line p-5 text-sm text-ink">
            <p className="u-label">Shipping to</p>
            <p className="mt-2">{shipping.name}</p>
            <p>
              {shipping.line1}
              {shipping.line2 ? `, ${shipping.line2}` : ""}
            </p>
            <p>
              {shipping.city}, {shipping.stateName} {shipping.postcode}
            </p>
            <p>{shipping.phone}</p>
          </div>
        )}
      </div>

      {order.shipments.length > 0 && (
        <div className="mt-6 rounded-[10px] border border-line p-5 text-sm text-ink">
          <p className="u-label">Tracking</p>
          {order.shipments.map((s) => (
            <div key={s.id} className="mt-3">
              <Row label="Carrier" value={s.courier ?? "Shadowfax"} />
              {s.awb && <Row label="AWB" value={s.awb} />}
              <Row label="Status" value={s.statusNormalized.replaceAll("_", " ")} />
              {s.trackingUrl && (
                <a
                  href={s.trackingUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-block text-xs underline underline-offset-2 hover:opacity-70"
                >
                  Track on the carrier site
                </a>
              )}
              {s.events.length > 0 && (
                <ol className="mt-2 space-y-0.5 text-[11px] text-ink-soft">
                  {s.events.slice(-6).map((e) => (
                    <li key={e.id}>
                      {(e.statusNormalized ?? e.statusRaw ?? "").replaceAll("_", " ")}
                      {e.occurredAt
                        ? ` — ${new Date(e.occurredAt).toLocaleDateString("en-IN")}`
                        : ""}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}

      <table className="mt-8 w-full text-sm text-ink">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 font-bold uppercase tracking-[0.06em] text-[0.75rem] text-ink-strong">
              Item
            </th>
            <th className="py-2 font-bold uppercase tracking-[0.06em] text-[0.75rem] text-ink-strong">
              Qty
            </th>
            <th className="py-2 text-right font-bold uppercase tracking-[0.06em] text-[0.75rem] text-ink-strong">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-line">
              <td className="py-3">
                {i.title}
                {i.size ? ` · ${i.size}` : ""}
                <span className="block text-[11px] text-ink-soft">
                  {CATALOG_LABEL[i.catalog]}
                </span>
              </td>
              <td className="py-3">{i.quantity}</td>
              <td className="py-3 text-right">{formatPaiseINR(i.totalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 ml-auto max-w-xs">
        <Row label="Subtotal" value={formatPaiseINR(order.subtotalPaise)} />
        {order.discountPaise > 0 && (
          <Row label="Discount" value={`-${formatPaiseINR(order.discountPaise)}`} />
        )}
        <Row label="Shipping" value={formatPaiseINR(order.shippingPaise)} />
        {order.codFeePaise > 0 && (
          <Row label="COD fee" value={formatPaiseINR(order.codFeePaise)} />
        )}
        <Row label="Tax" value={formatPaiseINR(order.taxPaise)} />
        <div className="mt-1 flex justify-between border-t border-line pt-2 text-sm text-ink-strong">
          <span className="font-bold uppercase tracking-[0.06em] text-[0.8125rem]">
            Total
          </span>
          <span>{formatPaiseINR(order.totalPaise)}</span>
        </div>
      </div>
    </div>
  );
}

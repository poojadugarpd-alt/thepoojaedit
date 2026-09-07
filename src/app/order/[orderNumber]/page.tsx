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
      <span className="text-black/55 dark:text-white/55">{label}</span>
      <span>{value}</span>
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
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Order not found</h1>
        <p className="mt-3 text-sm text-black/60 dark:text-white/60">
          We couldn&rsquo;t find that order, or the link has expired. Check the link in
          your confirmation, or sign in to your account.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          Back to shop
        </Link>
      </div>
    );
  }

  const shipping = order.addresses.find((a) => a.type === "SHIPPING");
  const billing = order.addresses.find((a) => a.type === "BILLING");

  const awaitingPrepaid =
    order.paymentMethod === "PREPAID_RAZORPAY" &&
    order.orderStatus === "PENDING_PAYMENT";

  const banner = review
    ? {
        tone: "amber" as const,
        text: "We've received your payment and are reviewing this order. We'll email you shortly — no action needed.",
      }
    : placed && order.paymentMethod === "COD"
      ? {
          tone: "green" as const,
          text: "Order placed. It's pending confirmation — we'll message you to confirm your cash-on-delivery order.",
        }
      : placed && !awaitingPrepaid
        ? { tone: "green" as const, text: "Payment received — your order is confirmed." }
        : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-xl font-semibold">Order {order.orderNumber}</h1>

      {banner && (
        <p
          className={`mt-3 rounded border px-3 py-2 text-sm ${
            banner.tone === "green"
              ? "border-green-600/30 bg-green-600/5 text-green-800 dark:text-green-300"
              : "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-200"
          }`}
        >
          {banner.text}
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
      <p className="mt-1 text-sm text-black/55 dark:text-white/55">
        Placed{" "}
        {order.placedAt ? new Date(order.placedAt).toLocaleDateString("en-IN") : "—"}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-black/10 p-4 text-sm dark:border-white/15">
          <p className="font-medium">Status</p>
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
        {shipping && (
          <div className="rounded border border-black/10 p-4 text-sm dark:border-white/15">
            <p className="font-medium">Shipping to</p>
            <p className="mt-1">{shipping.name}</p>
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
        <div className="mt-6 rounded border border-black/10 p-4 text-sm dark:border-white/15">
          <p className="font-medium">Tracking</p>
          {order.shipments.map((s) => (
            <div key={s.id} className="mt-2">
              <Row label="Carrier" value={s.courier ?? "Shadowfax"} />
              {s.awb && <Row label="AWB" value={s.awb} />}
              <Row
                label="Status"
                value={s.statusNormalized.replaceAll("_", " ")}
              />
              {s.trackingUrl && (
                <a
                  href={s.trackingUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-block text-xs underline"
                >
                  Track on the carrier site
                </a>
              )}
              {s.events.length > 0 && (
                <ol className="mt-2 space-y-0.5 text-[11px] text-black/55 dark:text-white/55">
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

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-black/15 text-left dark:border-white/20">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-black/10 dark:border-white/10">
              <td className="py-2">
                {i.title}
                {i.size ? ` · ${i.size}` : ""}
                <span className="block text-[11px] text-black/45 dark:text-white/45">
                  {CATALOG_LABEL[i.catalog]}
                </span>
              </td>
              <td className="py-2">{i.quantity}</td>
              <td className="py-2 text-right">{formatPaiseINR(i.totalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto max-w-xs">
        <Row label="Subtotal" value={formatPaiseINR(order.subtotalPaise)} />
        {order.discountPaise > 0 && (
          <Row label="Discount" value={`-${formatPaiseINR(order.discountPaise)}`} />
        )}
        <Row label="Shipping" value={formatPaiseINR(order.shippingPaise)} />
        {order.codFeePaise > 0 && (
          <Row label="COD fee" value={formatPaiseINR(order.codFeePaise)} />
        )}
        <Row label="Tax" value={formatPaiseINR(order.taxPaise)} />
        <div className="mt-1 flex justify-between border-t border-black/15 pt-2 text-sm font-semibold dark:border-white/20">
          <span>Total</span>
          <span>{formatPaiseINR(order.totalPaise)}</span>
        </div>
      </div>
    </div>
  );
}

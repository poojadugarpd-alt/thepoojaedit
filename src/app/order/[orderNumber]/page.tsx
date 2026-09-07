import type { Metadata } from "next";
import Link from "next/link";

import { formatPaiseINR } from "@/lib/money";
import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { getCurrentCustomer } from "@/server/auth/current-customer";
import { ResourceNotFoundError } from "@/server/auth/errors";
import { getViewableOrderForCustomer, getViewableOrderForGuest } from "@/server/orders";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
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
  const { token } = await searchParams;

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-xl font-semibold">Order {order.orderNumber}</h1>
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

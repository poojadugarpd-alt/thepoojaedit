"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { IN_STATES } from "@/lib/in-states";
import { formatPaiseINR } from "@/lib/money";
import { useCart } from "@/features/cart/store";

import {
  finalizePrepaidAction,
  placeCheckoutAction,
  prepareCheckoutAction,
  type QuoteSummary,
} from "@/app/checkout/actions";
import { openRazorpayCheckout } from "./razorpay";

type Method = "PREPAID_RAZORPAY" | "COD";

interface AddressForm {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  stateCode: string;
  postcode: string;
}

const EMPTY_ADDRESS: AddressForm = {
  name: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  stateCode: "",
  postcode: "",
};

function field(a: AddressForm) {
  return { ...a, country: "IN" as const };
}

export function CheckoutClient({ prepaidEnabled }: { prepaidEnabled: boolean }) {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const clearCart = useCart((s) => s.clear);

  const [addr, setAddr] = useState<AddressForm>(EMPTY_ADDRESS);
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<Method>(prepaidEnabled ? "PREPAID_RAZORPAY" : "COD");
  const [quote, setQuote] = useState<QuoteSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderLines = useMemo(
    () => lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    [lines],
  );
  const displaySubtotal = useMemo(
    () => lines.reduce((s, l) => s + l.unitPricePaise * l.quantity, 0),
    [lines],
  );

  if (hydrated && lines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-4 text-sm text-black/65 dark:text-white/65">
          Your cart is empty.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  const set = (k: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddr((a) => ({ ...a, [k]: e.target.value }));
    setQuote(null);
  };

  async function onReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await prepareCheckoutAction({
        lines: orderLines,
        paymentMethod: method,
        destinationStateCode: addr.stateCode,
        destinationPostcode: addr.postcode,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setQuote(res.quote);
    } finally {
      setBusy(false);
    }
  }

  async function onPlace() {
    if (!quote) return;
    setError(null);
    setBusy(true);
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await placeCheckoutAction({
        idempotencyKey,
        lines: orderLines,
        paymentMethod: method,
        email,
        contactPhone: addr.phone,
        billing: field(addr),
        shipping: field(addr),
        clientQuoteHash: quote.hash,
        source: "web-checkout",
      });

      if (!res.ok) {
        if (res.error === "price_changed") {
          setQuote(null);
          setError("Prices or availability changed. Please review your order again.");
        } else {
          setError(res.error);
        }
        return;
      }

      const orderUrl = `/order/${res.orderNumber}${res.token ? `?token=${encodeURIComponent(res.token)}` : ""}`;

      if (res.method === "COD") {
        clearCart();
        router.push(`${orderUrl}${res.token ? "&" : "?"}placed=1`);
        return;
      }

      // Prepaid → open Razorpay Checkout.
      if (!res.prepaid) {
        setError("Couldn't start the payment. Please try again.");
        return;
      }
      await openRazorpayCheckout({
        keyId: res.prepaid.keyId,
        providerOrderId: res.prepaid.providerOrderId,
        amountPaise: res.prepaid.amountPaise,
        prefill: { name: addr.name, email, contact: addr.phone },
        onDismiss: () => {
          setBusy(false);
          setError(
            "Payment was not completed. Your order is saved — you can pay from the order page.",
          );
          router.push(`${orderUrl}${res.token ? "&" : "?"}placed=1`);
        },
        onSuccess: async (r) => {
          const fin = await finalizePrepaidAction({
            providerOrderId: r.razorpay_order_id,
            providerPaymentId: r.razorpay_payment_id,
            signature: r.razorpay_signature,
          });
          clearCart();
          if (fin.ok) {
            router.push(`${orderUrl}${res.token ? "&" : "?"}placed=1`);
          } else {
            router.push(`${orderUrl}${res.token ? "&" : "?"}review=1`);
          }
        },
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      // For prepaid the modal callbacks manage `busy`; clear it for the sync paths.
      if (method === "COD") setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>

      <ol className="mt-6 space-y-6">
        <li>
          <h2 className="text-sm font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
            Delivery address
          </h2>
          <form onSubmit={onReview} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input label="Full name" value={addr.name} onChange={set("name")} required autoComplete="name" />
            <Input label="Phone" value={addr.phone} onChange={set("phone")} required inputMode="tel" autoComplete="tel" />
            <Input label="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className="sm:col-span-2" />
            <Input label="Address" value={addr.line1} onChange={set("line1")} required autoComplete="address-line1" className="sm:col-span-2" />
            <Input label="Apartment, suite (optional)" value={addr.line2} onChange={set("line2")} autoComplete="address-line2" className="sm:col-span-2" />
            <Input label="City" value={addr.city} onChange={set("city")} required autoComplete="address-level2" />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-black/60 dark:text-white/60">State</span>
              <select
                value={addr.stateCode}
                onChange={set("stateCode")}
                required
                className="rounded border border-black/20 bg-transparent px-3 py-2 dark:border-white/25"
              >
                <option value="">Choose…</option>
                {IN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="PIN code" value={addr.postcode} onChange={set("postcode")} required inputMode="numeric" autoComplete="postal-code" />

            <fieldset className="sm:col-span-2 mt-2">
              <legend className="text-sm text-black/60 dark:text-white/60">Payment</legend>
              <div className="mt-2 flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="method"
                    checked={method === "PREPAID_RAZORPAY"}
                    disabled={!prepaidEnabled}
                    onChange={() => {
                      setMethod("PREPAID_RAZORPAY");
                      setQuote(null);
                    }}
                  />
                  <span>
                    Pay online (UPI / card / netbanking)
                    {!prepaidEnabled && (
                      <span className="ml-1 text-black/45 dark:text-white/45">
                        — not available in this environment
                      </span>
                    )}
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="method"
                    checked={method === "COD"}
                    onChange={() => {
                      setMethod("COD");
                      setQuote(null);
                    }}
                  />
                  <span>Cash on delivery</span>
                </label>
              </div>
            </fieldset>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {busy && !quote ? "Checking…" : "Review order"}
              </button>
            </div>
          </form>
        </li>

        {quote && (
          <li>
            <h2 className="text-sm font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
              Review &amp; pay
            </h2>
            <div className="mt-3 rounded border border-black/10 p-4 dark:border-white/15">
              <table className="w-full text-sm">
                <tbody>
                  {quote.lines.map((l) => (
                    <tr key={l.variantId}>
                      <td className="py-1">
                        {l.title}
                        {l.size ? ` · ${l.size}` : ""} × {l.quantity}
                      </td>
                      <td className="py-1 text-right">{formatPaiseINR(l.lineTotalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="mt-3 space-y-1 border-t border-black/10 pt-3 text-sm dark:border-white/10">
                <Line label="Subtotal" value={quote.subtotalPaise} />
                {quote.discountPaise > 0 && <Line label="Discount" value={-quote.discountPaise} />}
                <Line label="Shipping" value={quote.shippingPaise} />
                {quote.codFeePaise > 0 && <Line label="COD fee" value={quote.codFeePaise} />}
                <Line label="Tax" value={quote.taxPaise} />
                <div className="flex justify-between border-t border-black/15 pt-1 font-semibold dark:border-white/20">
                  <dt>Total</dt>
                  <dd>{formatPaiseINR(quote.totalPaise)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-black/45 dark:text-white/45">
                Stock is held for {Math.round(quote.reservationTtlSeconds / 60)} minutes
                after you place a prepaid order.
              </p>
              <button
                onClick={onPlace}
                disabled={busy}
                className="mt-4 w-full rounded bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {busy
                  ? "Working…"
                  : method === "COD"
                    ? "Place order (Cash on delivery)"
                    : `Pay ${formatPaiseINR(quote.totalPaise)}`}
              </button>
            </div>
          </li>
        )}
      </ol>

      {error && (
        <p role="alert" className="mt-4 rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <p className="mt-6 text-xs text-black/45 dark:text-white/45">
        Cart total (as displayed): {formatPaiseINR(displaySubtotal)} across{" "}
        {lines.map((l) => CATALOG_LABEL[l.catalog]).filter((v, i, a) => a.indexOf(v) === i).join(" + ")}.
        The server recalculates the exact price and tax above.
      </p>
    </div>
  );
}

function Input({
  label,
  className,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <input
        {...rest}
        className="rounded border border-black/20 bg-transparent px-3 py-2 dark:border-white/25"
      />
    </label>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-black/55 dark:text-white/55">{label}</dt>
      <dd>{formatPaiseINR(value)}</dd>
    </div>
  );
}

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

export function CheckoutClient({
  prepaidEnabled,
  codEnabled,
}: {
  prepaidEnabled: boolean;
  codEnabled: boolean;
}) {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const clearCart = useCart((s) => s.clear);

  const [addr, setAddr] = useState<AddressForm>(EMPTY_ADDRESS);
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<Method>(
    prepaidEnabled ? "PREPAID_RAZORPAY" : codEnabled ? "COD" : "PREPAID_RAZORPAY",
  );
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
      <div className="u-page max-w-lg py-24">
        <h1 className="u-h2">Checkout</h1>
        <p className="u-lead mt-4">Your cart is empty.</p>
        <Link href="/" className="u-textlink mt-6">
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
    <div className="u-page max-w-2xl py-12 sm:py-16">
      <h1 className="u-h2">Checkout</h1>

      <ol className="mt-10 space-y-10">
        <li>
          <h2 className="u-label">Delivery address</h2>
          <form onSubmit={onReview} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input label="Full name" value={addr.name} onChange={set("name")} required autoComplete="name" />
            <Input label="Phone" value={addr.phone} onChange={set("phone")} required inputMode="tel" autoComplete="tel" />
            <Input label="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className="sm:col-span-2" />
            <Input label="Address" value={addr.line1} onChange={set("line1")} required autoComplete="address-line1" className="sm:col-span-2" />
            <Input label="Apartment, suite (optional)" value={addr.line2} onChange={set("line2")} autoComplete="address-line2" className="sm:col-span-2" />
            <Input label="City" value={addr.city} onChange={set("city")} required autoComplete="address-level2" />
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="u-label u-label--muted">State</span>
              <select
                value={addr.stateCode}
                onChange={set("stateCode")}
                required
                className="rounded-[10px] border border-line bg-transparent px-3 py-2.5 text-ink focus-visible:border-ink-strong"
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
              <legend className="u-label u-label--muted">Payment</legend>
              <div className="mt-3 flex flex-col gap-2 text-sm">
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
                      <span className="ml-1 text-ink-soft">
                        — not available in this environment
                      </span>
                    )}
                  </span>
                </label>
                {codEnabled && (
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
                )}
              </div>
            </fieldset>

            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="u-pill">
                {busy && !quote ? "Checking…" : "Review order"}
              </button>
            </div>
          </form>
        </li>

        {quote && (
          <li>
            <h2 className="u-label">Review &amp; pay</h2>
            <div className="mt-4 rounded-[10px] border border-line p-5">
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
              <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
                <Line label="Subtotal" value={quote.subtotalPaise} />
                {quote.discountPaise > 0 && <Line label="Discount" value={-quote.discountPaise} />}
                <Line label="Shipping" value={quote.shippingPaise} />
                {quote.codFeePaise > 0 && <Line label="COD fee" value={quote.codFeePaise} />}
                <Line label="Tax" value={quote.taxPaise} />
                <div className="flex justify-between border-t border-line pt-2 text-ink-strong">
                  <dt className="font-bold uppercase tracking-[0.06em] text-[0.8125rem]">
                    Total
                  </dt>
                  <dd>{formatPaiseINR(quote.totalPaise)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] text-ink-soft">
                Stock is held for {Math.round(quote.reservationTtlSeconds / 60)} minutes
                after you place a prepaid order.
              </p>
              <button
                onClick={onPlace}
                disabled={busy}
                className="u-pill mt-5 w-full"
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
        <p
          role="alert"
          className="mt-6 rounded-[10px] border border-ink-strong bg-fill px-4 py-3 text-sm text-ink-strong"
        >
          {error}
        </p>
      )}

      <p className="mt-8 text-xs text-ink-soft">
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
    <label className={`flex flex-col gap-1.5 text-sm ${className ?? ""}`}>
      <span className="u-label u-label--muted">{label}</span>
      <input
        {...rest}
        className="rounded-[10px] border border-line bg-transparent px-3 py-2.5 text-ink focus-visible:border-ink-strong"
      />
    </label>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-ink">{formatPaiseINR(value)}</dd>
    </div>
  );
}

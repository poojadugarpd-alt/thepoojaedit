"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { resumePaymentAction } from "@/app/checkout/actions";

import { openRazorpayCheckout } from "./razorpay";
import { finalizePrepaidAction } from "@/app/checkout/actions";

/**
 * Pending-payment recovery (master §8 "pending-payment UI/recovery"). Shown on
 * the order page for a prepaid order still in PENDING_PAYMENT. Starts a fresh
 * payment attempt (new provider order) and reopens Razorpay Checkout.
 */
export function ResumePayment({
  orderNumber,
  token,
  name,
  email,
  phone,
}: {
  orderNumber: string;
  token: string | null;
  name?: string;
  email?: string | null;
  phone?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onResume() {
    if (!token) {
      setError("Open this page from your confirmation link to complete payment.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await resumePaymentAction({ orderNumber, token });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      await openRazorpayCheckout({
        keyId: res.keyId,
        providerOrderId: res.providerOrderId,
        amountPaise: res.amountPaise,
        prefill: { name, email: email ?? undefined, contact: phone },
        onDismiss: () => setBusy(false),
        onSuccess: async (r) => {
          await finalizePrepaidAction({
            providerOrderId: r.razorpay_order_id,
            providerPaymentId: r.razorpay_payment_id,
            signature: r.razorpay_signature,
          });
          router.refresh();
          setBusy(false);
        },
      });
    } catch {
      setError("Couldn't start the payment. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-[10px] border border-ink-strong bg-fill p-4 text-sm">
      <p className="u-label">Payment not completed</p>
      <p className="mt-2 text-ink">
        Your order is saved and the items are held for a short time. Complete the
        payment to confirm it.
      </p>
      <button onClick={onResume} disabled={busy} className="u-pill mt-4">
        {busy ? "Opening payment…" : "Complete payment"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-xs text-ink-strong">
          {error}
        </p>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

// Placeholder. The authoritative checkout (quote, tax, atomic reservation,
// payment) is built in Phase 5 — this page deliberately does NOT simulate it.
export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
      <p className="mt-4 text-sm text-black/65 dark:text-white/65">
        Checkout isn&rsquo;t open yet. Your cart is saved on this device — come back
        once payments are live.
      </p>
      <Link href="/cart" className="mt-6 inline-block text-sm underline">
        Back to cart
      </Link>
    </div>
  );
}

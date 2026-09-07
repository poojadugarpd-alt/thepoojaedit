import type { Metadata } from "next";

import { CartView } from "@/features/cart/cart-view";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Pieces from both catalogues can be checked out together.
      </p>
      <div className="mt-8">
        <CartView />
      </div>
    </div>
  );
}

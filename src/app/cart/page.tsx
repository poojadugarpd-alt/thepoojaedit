import type { Metadata } from "next";

import { CartView } from "@/features/cart/cart-view";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false },
};

export default function CartPage() {
  return (
    <div className="u-page py-14 sm:py-20">
      <h1 className="u-display">Your cart</h1>
      <p className="u-lead mt-5">
        Pieces from both catalogues can be checked out together.
      </p>
      <div className="mt-12">
        <CartView />
      </div>
    </div>
  );
}

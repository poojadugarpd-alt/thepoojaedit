"use client";

import Link from "next/link";

import { selectCount, useCart } from "./store";

export function CartLink() {
  const hydrated = useCart((s) => s.hydrated);
  const count = useCart(selectCount);
  return (
    <Link
      href="/cart"
      className="u-label u-label--muted hover:opacity-70"
      aria-label={hydrated && count > 0 ? `Cart, ${count} items` : "Cart"}
    >
      Cart{hydrated && count > 0 ? ` (${count})` : ""}
    </Link>
  );
}

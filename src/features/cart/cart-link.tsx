"use client";

import Link from "next/link";

import { selectCount, useCart } from "./store";

export function CartLink() {
  const hydrated = useCart((s) => s.hydrated);
  const count = useCart(selectCount);
  return (
    <Link href="/cart" className="hover:underline underline-offset-4">
      Cart
      {hydrated && count > 0 && (
        <span
          aria-label={`${count} items in cart`}
          className="ml-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background"
        >
          {count}
        </span>
      )}
    </Link>
  );
}

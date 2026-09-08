import Link from "next/link";

import { CartLink } from "@/features/cart/cart-link";

const CATALOG_LINKS = [
  { href: "/the-pooja-edit", label: "The Pooja Edit" },
  { href: "/thrift", label: "Thrift Store" },
];

const UTILITY_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/account", label: "Account" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/80 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="u-page flex flex-wrap items-center gap-x-7 gap-y-2 py-4 sm:py-6"
      >
        <Link
          href="/"
          aria-label="The Pooja Edit — home"
          className="u-label shrink-0 hover:opacity-70"
        >
          THE POOJA EDIT
        </Link>

        <ul className="flex gap-x-6 gap-y-1">
          {CATALOG_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="u-label u-label--muted hover:opacity-70">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <ul className="ml-auto flex items-center gap-5">
          {UTILITY_LINKS.map((link) => (
            <li key={link.href} className="hidden sm:block">
              <Link href={link.href} className="u-label u-label--muted hover:opacity-70">
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <CartLink />
          </li>
        </ul>
      </nav>
    </header>
  );
}

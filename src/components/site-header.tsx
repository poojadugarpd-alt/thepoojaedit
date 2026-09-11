import Link from "next/link";

import { CartLink } from "@/features/cart/cart-link";
import { CATALOG_LABEL_SHORT, SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";

const CATALOG_LINKS = (["THE_POOJA_EDIT", "THRIFT"] as const).map((catalog) => ({
  href: `/${SEGMENT_BY_CATALOG[catalog]}`,
  label: CATALOG_LABEL_SHORT[catalog],
}));

// "Account" is hidden until the Supabase Auth UI is built — checkout is
// guest-only for now and there is no /account route.
const UTILITY_LINKS = [{ href: "/search", label: "Search" }];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      <nav
        aria-label="Primary"
        className="u-bar flex flex-wrap items-center gap-x-7 gap-y-2 px-4 py-4 sm:px-6 sm:py-5"
      >
        <Link
          href="/"
          aria-label="The Pooja Edit by Pooja Dugar — home"
          className="u-navlink flex shrink-0 flex-col gap-0.5 !text-ink-strong"
        >
          <span>THE POOJA EDIT</span>
          <span className="text-[0.625rem] font-normal normal-case tracking-normal text-ink-soft">
            by Pooja Dugar
          </span>
        </Link>

        <ul className="flex gap-x-6 gap-y-1">
          {CATALOG_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="u-navlink">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <ul className="ml-auto flex items-center gap-x-6">
          {UTILITY_LINKS.map((link) => (
            <li key={link.href} className="hidden sm:block">
              <Link href={link.href} className="u-navlink">
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

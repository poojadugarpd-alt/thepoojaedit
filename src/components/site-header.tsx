import Link from "next/link";

import { HeaderLogo } from "@/components/brand/logo";
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
        className="u-bar flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-4 sm:gap-x-7 sm:px-6 sm:py-5"
      >
        <Link
          href="/"
          aria-label="The Pooja Edit by Pooja Dugar — home"
          className="flex min-h-11 shrink-0 items-center text-brand-maroon"
        >
          <HeaderLogo className="h-6 w-auto sm:h-10" />
        </Link>

        <ul className="flex gap-x-4 gap-y-1 sm:gap-x-6">
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

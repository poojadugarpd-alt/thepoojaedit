import Link from "next/link";

import { HeaderLogo } from "@/components/brand/logo";
import { CartLink } from "@/features/cart/cart-link";
import { CATALOG_LABEL_SHORT, SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";

type NavLink = {
  href: string;
  label: string;
  shortLabel?: string;
  /** Another site: opens in a new tab so the shopper keeps their cart here. */
  external?: boolean;
};

const CATALOG_LINKS: NavLink[] = [
  ...(["THE_POOJA_EDIT", "THRIFT"] as const).map((catalog) => ({
    href: `/${SEGMENT_BY_CATALOG[catalog]}`,
    label: CATALOG_LABEL_SHORT[catalog],
  })),
  // Static link: /styling is published (2026-10-20). If it is unpublished
  // again, remove this or it leads shoppers to a 404.
  // The full label pushes Cart onto a third row at 360px, so phones get "Styling".
  { href: "/styling", label: "Styling & Shopping", shortLabel: "Styling" },
  // Pooja's LehLah shop-my-looks page (affiliate picks), not our /looks.
  {
    href: "https://lehlah.club/poojadugar?utm_source=thepoojaedit&utm_medium=website&utm_content=header",
    label: "Shop Looks",
    external: true,
  },
];

// "Account" is hidden until the Supabase Auth UI is built — checkout is
// guest-only for now and there is no /account route.
const UTILITY_LINKS = [{ href: "/search", label: "Search" }];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      <nav
        aria-label="Primary"
        className="u-bar flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-4 sm:gap-x-7 sm:px-6 sm:py-5"
      >
        <Link
          href="/"
          aria-label="The Pooja Edit by Pooja Dugar — home"
          className="flex min-h-11 shrink-0 items-center text-brand-maroon"
        >
          <HeaderLogo className="h-6 w-auto sm:h-10" />
        </Link>

        <ul className="order-last flex w-full gap-x-3 gap-y-1 whitespace-nowrap sm:gap-x-6 lg:order-none lg:w-auto">
          {CATALOG_LINKS.map((link) => {
            const text = link.shortLabel ? (
              <>
                <span className="sm:hidden">{link.shortLabel}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </>
            ) : (
              link.label
            );
            return (
              <li key={link.href}>
                {link.external ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="u-navlink"
                  >
                    {text}
                  </a>
                ) : (
                  <Link href={link.href} className="u-navlink">
                    {text}
                  </Link>
                )}
              </li>
            );
          })}
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

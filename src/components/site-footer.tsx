import Link from "next/link";

import { FullLogo } from "@/components/brand/logo";
import { CATALOG_LABEL, SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";

const SHOP_LINKS = [
  {
    href: `/${SEGMENT_BY_CATALOG.THE_POOJA_EDIT}`,
    label: CATALOG_LABEL.THE_POOJA_EDIT,
  },
  { href: `/${SEGMENT_BY_CATALOG.THRIFT}`, label: CATALOG_LABEL.THRIFT },
  { href: "/search", label: "Search" },
];

const HELP_LINKS = [
  { href: "/size-guide", label: "Size guide" },
  { href: "/policies/shipping", label: "Shipping" },
  { href: "/policies/returns-exchanges", label: "Returns & exchanges" },
  { href: "/contact", label: "Contact" },
];

const STUDIO_LINKS = [
  { href: "/about", label: "About" },
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies/terms", label: "Terms" },
];

const COLUMNS = [
  { heading: "Shop", links: SHOP_LINKS },
  { heading: "Help", links: HELP_LINKS },
  { heading: "Studio", links: STUDIO_LINKS },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-fill">
      <div className="u-page py-16 sm:py-20">
        <div
          role="img"
          aria-label="The Pooja Edit — by Pooja Dugar"
          className="w-60 max-w-full text-brand-maroon"
        >
          <FullLogo className="h-auto w-full" />
        </div>
        <p className="u-lead mt-3">Realistic, wearable clothes by Pooja Dugar.</p>

        <nav
          aria-label="Footer"
          className="mt-12 grid gap-10 sm:grid-cols-3 sm:max-w-2xl"
        >
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="u-label">{col.heading}</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.95rem] text-ink hover:text-ink-strong"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-soft">
            © {new Date().getFullYear()} The Pooja Edit. All prices in INR, inclusive of
            taxes where applicable.
          </p>
          <a
            href="https://www.instagram.com/poojadugar_/"
            target="_blank"
            rel="noreferrer noopener"
            className="u-textlink"
          >
            @poojadugar_
          </a>
        </div>
      </div>
    </footer>
  );
}

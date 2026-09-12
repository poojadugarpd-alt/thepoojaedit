"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Bottom tab bar — mobile only (`sm:hidden`), the desktop sidebar in
 * src/app/admin/layout.tsx is unchanged and hidden on mobile instead. Four
 * destinations per the admin-PWA plan (docs/admin-pwa-plan.md §1): Home,
 * Orders, Products, More (the other 7 modules + Install + Sign out).
 */

const TABS = [
  { href: "/admin", label: "Home", match: (p: string) => p === "/admin" },
  {
    href: "/admin/orders",
    label: "Orders",
    match: (p: string) => p.startsWith("/admin/orders"),
  },
  {
    href: "/admin/products",
    label: "Products",
    match: (p: string) => p.startsWith("/admin/products"),
  },
  {
    href: "/admin/more",
    label: "More",
    match: (p: string) =>
      p.startsWith("/admin/more") ||
      p.startsWith("/admin/inventory") ||
      p.startsWith("/admin/returns") ||
      p.startsWith("/admin/customers") ||
      p.startsWith("/admin/notifications") ||
      p.startsWith("/admin/analytics") ||
      p.startsWith("/admin/activity") ||
      p.startsWith("/admin/settings") ||
      p.startsWith("/admin/install"),
  },
];

// Minimal glyphs — no icon font/library, four flat shapes that read at a
// glance. Decorative; the label alone is the accessible name.
const GLYPH: Record<string, string> = {
  Home: "⌂",
  Orders: "▤",
  Products: "◧",
  More: "•••",
};

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin"
      className="u-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ground sm:hidden"
    >
      <ul className="flex">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
                  active ? "text-ink-strong" : "text-ink-soft"
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {GLYPH[tab.label]}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

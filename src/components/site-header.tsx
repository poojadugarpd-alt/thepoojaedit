import Link from "next/link";

const CATALOG_LINKS = [
  { href: "/the-pooja-edit", label: "The Pooja Edit" },
  { href: "/thrift", label: "Thrift Store" },
];

const UTILITY_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/cart", label: "Cart" },
  { href: "/account", label: "Account" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
      >
        <Link
          href="/"
          aria-label="The Pooja Edit — home"
          className="font-mono text-sm font-bold tracking-tight"
        >
          THE POOJA EDIT
        </Link>
        <ul className="flex gap-4 text-sm">
          {CATALOG_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:underline underline-offset-4">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="ml-auto flex gap-4 text-sm text-black/70 dark:text-white/70">
          {UTILITY_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:underline underline-offset-4">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

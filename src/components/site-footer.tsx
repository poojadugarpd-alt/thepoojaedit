import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/size-guide", label: "Size guide" },
  { href: "/policies/shipping", label: "Shipping" },
  { href: "/policies/returns-exchanges", label: "Returns & exchanges" },
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies/terms", label: "Terms" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-black/10 dark:border-white/15">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-black/70 dark:text-white/70">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:underline underline-offset-4">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-6">
          © {new Date().getFullYear()} The Pooja Edit. All prices in INR, inclusive of
          taxes where applicable.
        </p>
      </div>
    </footer>
  );
}

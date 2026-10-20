import Link from "next/link";

const TABS = [
  { key: "enquiries", href: "/admin/styling", label: "Enquiries" },
  { key: "page", href: "/admin/styling/edit", label: "Page" },
  { key: "designs", href: "/admin/styling/designs", label: "My designs" },
  { key: "testimonials", href: "/admin/styling/testimonials", label: "Testimonials" },
  { key: "gallery", href: "/admin/styling/gallery", label: "Gallery" },
] as const;

export type StylingTab = (typeof TABS)[number]["key"];

/** Tabs across the top of every Admin → Styling screen. */
export function StylingTabs({ current }: { current: StylingTab }) {
  return (
    <nav
      aria-label="Styling sections"
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1"
    >
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium ${
            t.key === current
              ? "border-ink-strong text-ink-strong"
              : "border-transparent text-ink-soft"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

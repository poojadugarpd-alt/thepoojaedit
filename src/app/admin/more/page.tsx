import Link from "next/link";

export const metadata = { title: "More" };

/**
 * Mobile-only index for the secondary admin modules — the bottom nav (brief
 * 4b) only has 4 slots (Home/Orders/Products/More); everything else lives
 * here. Not a replacement for the desktop sidebar, which lists every module
 * directly and is unaffected.
 */
const ITEMS = [
  { href: "/admin/inventory", label: "Inventory", hint: "Stock levels and corrections" },
  { href: "/admin/returns", label: "Returns", hint: "Requests, inspection, resolution" },
  { href: "/admin/customers", label: "Customers", hint: "History and private notes" },
  {
    href: "/admin/notifications",
    label: "Notifications",
    hint: "Delivery failures and retries",
  },
  { href: "/admin/analytics", label: "Analytics", hint: "30-day financial summary" },
  { href: "/admin/activity", label: "Activity", hint: "Admin action log" },
  { href: "/admin/settings", label: "Settings", hint: "Credentials and store config" },
];

export default function AdminMorePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">More</h1>

      <ul className="divide-y divide-line rounded-[10px] border border-line">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-14 items-center justify-between px-4 py-3"
            >
              <span>
                <span className="block text-sm font-medium text-ink-strong">
                  {item.label}
                </span>
                <span className="block text-xs text-ink-soft">{item.hint}</span>
              </span>
              <span aria-hidden="true" className="text-ink-soft">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className="divide-y divide-line rounded-[10px] border border-line">
        <li>
          <Link
            href="/admin/install"
            className="flex min-h-14 items-center px-4 py-3 text-sm font-medium text-ink-strong"
          >
            Install on iPhone
          </Link>
        </li>
        <li>
          <Link
            href="/"
            className="flex min-h-14 items-center px-4 py-3 text-sm text-ink-soft"
          >
            ← storefront
          </Link>
        </li>
        <li>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="flex min-h-14 w-full items-center px-4 py-3 text-left text-sm text-stop"
            >
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { APP_ENV, APP_ENV_LABEL } from "@/lib/app-env";
import { AuthenticationError, AuthorizationError } from "@/server/auth/errors";
import { requireAdmin } from "@/server/auth/require-admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · The Pooja Edit" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/needs-attention", label: "Needs Attention" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/returns", label: "Returns" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let adminEmail: string;
  try {
    adminEmail = (await requireAdmin()).email;
  } catch (e) {
    const denied = e instanceof AuthenticationError || e instanceof AuthorizationError;
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Admin access required</h1>
        <p className="mt-3 text-sm text-black/65 dark:text-white/65">
          {denied
            ? "You are not signed in as an active admin."
            : "Admin is unavailable right now."}
        </p>
        <p className="mt-4 text-xs text-black/45 dark:text-white/45">
          Dev note: Supabase auth is not wired yet. Set{" "}
          <code className="font-mono">DEV_ADMIN_AUTH=1</code> in{" "}
          <code className="font-mono">.env.local</code> and seed an admin (`npm run
          db:seed`) to use the admin UI locally.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
      <aside className="w-44 shrink-0">
        <div className="mb-4 text-xs">
          <p className="font-semibold uppercase tracking-wide">Admin</p>
          <p className="mt-1 text-black/50 dark:text-white/50">{adminEmail}</p>
          <p className="text-black/40 dark:text-white/40">{APP_ENV_LABEL[APP_ENV]}</p>
        </div>
        <nav aria-label="Admin">
          <ul className="space-y-1 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="block rounded px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href="/"
                className="block px-2 py-1 text-xs text-black/50 dark:text-white/50"
              >
                ← storefront
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

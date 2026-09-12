import type { Metadata, Viewport } from "next";
import Link from "next/link";

import { MobileNav } from "@/features/admin/mobile-nav";
import { RegisterServiceWorker } from "@/features/admin/register-sw";
import { APP_ENV, APP_ENV_LABEL } from "@/lib/app-env";
import { AuthenticationError, AuthorizationError } from "@/server/auth/errors";
import { requireAdmin } from "@/server/auth/require-admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · The Pooja Edit" },
  robots: { index: false, follow: false },
  // NOT `manifest: "/admin/manifest.webmanifest"` here — empirically, Next
  // only honours the `manifest` metadata field from the ROOT layout; a
  // child segment's own value is silently dropped (unlike every other
  // field, which does override per segment — `icons` below proves that).
  // The admin manifest link is rendered directly as JSX further down
  // instead, which React 19 hoists into <head> on its own.
  //
  // `icons.apple` is set explicitly rather than relying on the `apple-icon.png`
  // file-naming convention: that convention does NOT reliably override per
  // segment (verified empirically — a src/app/admin/apple-icon.png produced
  // its own static route but the /admin page's rendered <head> still linked
  // the root icon). WebKit gives apple-touch-icon precedence over the
  // manifest's own icons (webkit.org/blog/13878), so this is the
  // load-bearing icon for "Add to Home Screen" on iOS, not the manifest.
  icons: {
    icon: "/brand/admin-icon-512.png",
    apple: "/brand/admin-apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pooja Admin",
  },
};

// viewport-fit=cover so env(safe-area-inset-*) resolves under the iPhone home
// indicator / notch (used by the fixed bottom nav — see globals.css u-safe-bottom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches the fixed top bar's bg-ground (#ffffff) — iOS colours the status
  // bar / task switcher chrome from this, not from the manifest's
  // background_color, once running standalone.
  themeColor: "#ffffff",
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
  // React 19 hoists a <link> rendered anywhere in the tree into <head> —
  // this is how /admin gets its own manifest link (see the `metadata`
  // comment above for why the Metadata API's `manifest` field can't do it).
  const adminManifestLink = <link rel="manifest" href="/admin/manifest.webmanifest" />;

  let adminEmail: string;
  try {
    adminEmail = (await requireAdmin()).email;
  } catch (e) {
    const denied = e instanceof AuthenticationError || e instanceof AuthorizationError;
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        {adminManifestLink}
        <h1 className="text-xl font-semibold">Admin access required</h1>
        <p className="mt-3 text-sm text-ink-soft">
          {denied
            ? "You are not signed in as an active admin."
            : "Admin is unavailable right now."}
        </p>
        <p className="mt-6">
          <Link
            href="/auth/login?next=/admin"
            className="inline-flex min-h-11 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background"
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-4 sm:py-8">
      {adminManifestLink}
      {/* Mobile top bar — brand + env only; navigation is the bottom tab bar. */}
      <div className="u-safe-top fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-line bg-ground px-4 py-3 sm:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-strong">
            Pooja Admin
          </p>
          <p className="text-[11px] text-ink-soft">{adminEmail}</p>
        </div>
        {APP_ENV !== "production" && (
          <span className="rounded bg-wait-bg px-2 py-1 text-[10px] font-semibold text-wait">
            {APP_ENV_LABEL[APP_ENV]}
          </span>
        )}
      </div>

      {/* Desktop sidebar — unchanged, hidden on mobile. */}
      <aside className="hidden w-44 shrink-0 sm:block">
        <div className="mb-4 text-xs">
          <p className="font-semibold uppercase tracking-wide">Admin</p>
          <p className="mt-1 text-ink-soft">{adminEmail}</p>
          <p className="text-ink-soft/70">{APP_ENV_LABEL[APP_ENV]}</p>
        </div>
        <nav aria-label="Admin">
          <ul className="space-y-1 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block rounded px-2 py-1 hover:bg-fill">
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link href="/" className="block px-2 py-1 text-xs text-ink-soft">
                ← storefront
              </Link>
            </li>
            <li>
              <form action="/auth/logout" method="post">
                <button
                  type="submit"
                  className="block px-2 py-1 text-xs text-ink-soft hover:text-ink-strong"
                >
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="min-w-0 flex-1 pt-14 pb-20 sm:pt-0 sm:pb-0">{children}</main>

      <MobileNav />
      <RegisterServiceWorker />
    </div>
  );
}

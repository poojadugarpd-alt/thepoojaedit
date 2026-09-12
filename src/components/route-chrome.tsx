"use client";

import { usePathname } from "next/navigation";

/**
 * Renders `storefront` everywhere except under `/admin`, where the admin
 * console has its own top bar + bottom tab nav (`src/app/admin/layout.tsx`)
 * and must never be wrapped in the customer-facing header/footer/ticker.
 *
 * `usePathname()` resolves correctly during static generation too (Next
 * knows each route's own path while prerendering it), so this doesn't force
 * the storefront's static/ISR pages into dynamic rendering the way reading
 * the request in the root layout via `headers()` would.
 */
export function RouteChrome({ storefront }: { storefront: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{storefront}</>;
}

import { NextResponse } from "next/server";

// Content never varies by request — same reasoning as the root manifest.ts,
// which Next statically prerenders by default.
export const dynamic = "force-static";

/**
 * Separate manifest for the admin console (D-101 / admin-PWA Stage 3).
 *
 * Next's `app/manifest.ts` file convention is root-only — it does not nest
 * under a segment the way `icon`/`apple-icon` do (confirmed empirically: a
 * `src/app/admin/manifest.ts` produces no extra route). A plain Route
 * Handler at this literal path serves the distinct JSON; the `<link
 * rel="manifest">` tag that actually points a page at it is rendered
 * directly as JSX in `src/app/admin/layout.tsx` (React 19 hoists it into
 * <head>), not via `metadata.manifest` — that field turned out to be
 * resolved from the root layout only, regardless of what a child segment
 * sets (see `src/app/manifest.webmanifest/route.ts` for the full story).
 *
 * `id`/`scope`/`start_url` are all "/admin" so this installs as its own
 * app, separate from the storefront's ("/", `src/app/manifest.webmanifest/route.ts`) — two
 * home-screen icons, two entries in iOS's app switcher, independent to
 * uninstall. Icons are the beige/maroon-inverted mark (`public/brand/
 * admin-icon-*.png`, built from `design/logo/mark-circle.png`) so the two
 * icons are unmistakable from each other on a home screen, not just a
 * text-label difference.
 */
export function GET() {
  return NextResponse.json(
    {
      id: "/admin",
      name: "The Pooja Edit Admin",
      short_name: "Pooja Admin",
      description: "Run The Pooja Edit — orders, products, inventory, returns — from your phone.",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      orientation: "portrait",
      background_color: "#EDE0CC",
      theme_color: "#EDE0CC",
      icons: [
        { src: "/brand/admin-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/brand/admin-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}

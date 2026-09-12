import { NextResponse } from "next/server";

// Content never varies by request.
export const dynamic = "force-static";

/**
 * Storefront manifest (D-96 icons; `id` added D-101). Deliberately a plain
 * Route Handler, matching src/app/admin/manifest.webmanifest/route.ts,
 * rather than the `app/manifest.ts` file convention it replaced — that
 * convention's `<link rel="manifest">` applied to EVERY route
 * unconditionally, and it turns out the `metadata.manifest` string field
 * has the exact same problem: it's resolved from the ROOT layout only, and
 * a child segment's own value is silently dropped (confirmed empirically —
 * unlike every other Metadata field, which does override per segment).
 * Because of that, the actual `<link rel="manifest">` tag for BOTH
 * manifests is rendered directly as JSX (`src/app/layout.tsx` for this one,
 * gated by RouteChrome; `src/app/admin/layout.tsx` for the admin one) —
 * React 19 hoists a <link> rendered anywhere in the tree into <head> on its
 * own, which is what actually lets each route link the right manifest.
 * This Route Handler only needs to exist and serve the right JSON; nothing
 * here handles wiring it into a page's <head>.
 *
 * Brand icons only (public/brand/icon-192.png, icon-512.png) — the site's
 * own colours stay white/white (D-96); maroon/beige are the logo's, not the
 * app chrome's.
 */
export function GET() {
  return NextResponse.json(
    {
      // WebKit uses the manifest `id` member to distinguish installs of the
      // same origin from each other (this storefront vs. the separate
      // "/admin" app). Without an explicit id it defaults to start_url,
      // which happens to be the same value here anyway — set explicitly so
      // it doesn't silently drift (D-101).
      id: "/",
      name: "The Pooja Edit",
      short_name: "Pooja Edit",
      start_url: "/",
      icons: [
        { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      background_color: "#FFFFFF",
      theme_color: "#FFFFFF",
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}

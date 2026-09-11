import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // This project directory is the workspace root even though it lives inside a
  // larger home folder; pin it so file tracing doesn't walk up to ~/.
  outputFileTracingRoot: path.join(__dirname),

  // `pino` / `pino-pretty` are Node libraries — don't try to bundle them.
  serverExternalPackages: ["pino", "pino-pretty"],

  // Bounded image hosts (master §9). The Supabase Storage host is added when a
  // project exists. The three below are the legacy source CDNs, used only by the
  // migration-draft dev dataset (migration/scripts/import-to-dev-db.mjs) so the
  // Phase 4 storefront has real imagery to render; production images come from
  // Supabase Storage.
  images: {
    remotePatterns: [
      // Product photography — Supabase Storage (public `product-images` bucket).
      { protocol: "https", hostname: "**.supabase.co" },
      // Legacy source CDNs — kept as a fallback; production images are on Storage.
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "shop-meta.s3.ap-south-1.amazonaws.com" },
      { protocol: "https", hostname: "dm2buy-aqbqh9cwb5cwb9he.z02.azurefd.net" },
      // Behold rehosts the @poojadugar_ Instagram feed images on its own CDN.
      { protocol: "https", hostname: "behold.pictures" },
      { protocol: "https", hostname: "**.behold.pictures" },
      { protocol: "https", hostname: "**.behold.so" },
    ],
  },

  // Storefront rename (D-93): /the-pooja-edit -> /label, /thrift -> /closet.
  // Permanent so search engines and old links update; :path* covers PDPs and
  // /collections/[slug] under each catalog.
  async redirects() {
    return [
      { source: "/the-pooja-edit", destination: "/label", permanent: true },
      { source: "/the-pooja-edit/:path*", destination: "/label/:path*", permanent: true },
      { source: "/thrift", destination: "/closet", permanent: true },
      { source: "/thrift/:path*", destination: "/closet/:path*", permanent: true },
    ];
  },
};

export default nextConfig;

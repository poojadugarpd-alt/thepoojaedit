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
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "shop-meta.s3.ap-south-1.amazonaws.com" },
      { protocol: "https", hostname: "dm2buy-aqbqh9cwb5cwb9he.z02.azurefd.net" },
    ],
  },
};

export default nextConfig;

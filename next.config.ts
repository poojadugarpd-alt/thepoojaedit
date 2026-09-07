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

  // Bounded image hosts. Supabase Storage host is added in Phase 3.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;

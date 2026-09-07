import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/public-env";

export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private / non-content surfaces excluded from crawling (master §4).
      disallow: [
        "/admin",
        "/account",
        "/cart",
        "/checkout",
        "/auth",
        "/api/",
        "/search",
        "/legacy-media/",
        "/order/",
        "/track-order",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

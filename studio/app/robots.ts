import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Everyone may crawl, AI assistants included (owner, 2026-10-20). The enquiry API isn't a page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { serviceIds } from "@/lib/services";

// Dates are when each page's content last changed (not the build date), so Google can trust them.
// Bump the date here when you edit a page's copy.
const HOME_UPDATED = "2026-10-20";
const SERVICES_UPDATED = "2026-10-21";
const UGC_UPDATED = "2026-10-21";
const PRICING_UPDATED = "2026-10-21";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, lastModified: HOME_UPDATED },
    ...serviceIds.map((id) => ({ url: `${site.url}/${id}`, lastModified: SERVICES_UPDATED })),
    { url: `${site.url}/ugc`, lastModified: UGC_UPDATED },
    { url: `${site.url}/pricing`, lastModified: PRICING_UPDATED },
  ];
}

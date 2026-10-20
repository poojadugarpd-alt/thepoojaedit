import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { serviceIds } from "@/lib/services";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url },
    ...serviceIds.map((id) => ({ url: `${site.url}/${id}` })),
  ];
}

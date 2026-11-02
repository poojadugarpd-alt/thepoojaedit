import type { Metadata } from "next";
import { fashionCreatorsPage as pg } from "@/lib/creator-pages";
import { CreatorPage } from "@/components/CreatorPage";

// Same hourly refresh as the home page, so the hero reels stay current.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: pg.seoTitle },
  description: pg.seoDescription,
  alternates: { canonical: pg.path },
  // Setting openGraph here replaces the root's, so restate the share image.
  openGraph: {
    title: pg.seoTitle,
    description: pg.seoDescription,
    url: pg.path,
    type: "website",
    locale: "en_IN",
    images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630 }],
  },
};

export default async function Page() {
  return <CreatorPage pg={pg} />;
}

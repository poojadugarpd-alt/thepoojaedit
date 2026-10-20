import "server-only";
import type { CanvaItem, GraphicCategory, GraphicItem, InstagramItem, ShowcaseData, Testimonial } from "./types";
import { getInstagram } from "./instagram";
import { getYouTube } from "./youtube";
import graphics from "@/content/graphics.json";
import testimonials from "@/content/testimonials.json";
import canva from "@/content/canva.json";

// Canva designs open on Canva (public view links); they replace the sample tiles.
const canvaItems = canva as CanvaItem[];

const canvaCarousels: InstagramItem[] = canvaItems
  .filter((c) => c.kind === "carousel")
  .map((c) => ({
    id: `canva-${c.id}`,
    kind: "carousel",
    permalink: c.url,
    externalUrl: c.url,
    caption: c.title,
    thumbnailUrl: c.cover,
    slideCount: c.pages > 1 ? c.pages : undefined,
    category: "carousel",
    carouselLabel: c.label,
    brand: c.client || undefined,
  }));

const canvaGraphics: GraphicItem[] = canvaItems
  .filter((c) => c.kind === "graphic")
  .map((c) => ({
    id: `canva-${c.id}`,
    title: c.title,
    category: c.label as GraphicCategory,
    image: c.cover,
    alt: c.client ? `${c.title} for ${c.client}` : c.title,
    ratio: `${c.width}/${c.height}`,
    href: c.url,
    client: c.client || undefined,
  }));

export async function getShowcase(): Promise<ShowcaseData> {
  const [ig, yt] = await Promise.all([getInstagram(), getYouTube()]);
  const igCarousels = ig.carousels.filter((c) => !c.sample);
  return {
    reels: ig.reels,
    carousels: canvaCarousels.length ? [...canvaCarousels, ...igCarousels] : ig.carousels,
    longForm: yt.longForm,
    shorts: yt.shorts,
    graphics: canvaGraphics.length ? canvaGraphics : (graphics as GraphicItem[]),
    testimonials: testimonials as Testimonial[],
    stats: { instagramFollowers: ig.followers, ...yt.stats },
    sources: { instagram: ig.source, youtube: yt.source },
  };
}

import "server-only";
import type { GraphicItem, ShowcaseData, Testimonial } from "./types";
import { getInstagram } from "./instagram";
import { getYouTube } from "./youtube";
import graphics from "@/content/graphics.json";
import testimonials from "@/content/testimonials.json";

export async function getShowcase(): Promise<ShowcaseData> {
  const [ig, yt] = await Promise.all([getInstagram(), getYouTube()]);
  return {
    reels: ig.reels,
    carousels: ig.carousels,
    longForm: yt.longForm,
    shorts: yt.shorts,
    graphics: graphics as GraphicItem[],
    testimonials: testimonials as Testimonial[],
    stats: { instagramFollowers: ig.followers, ...yt.stats },
    sources: { instagram: ig.source, youtube: yt.source },
  };
}

import "server-only";
import type { InstagramItem } from "./types";
import { categorize, carouselLabel, detectBrand } from "./categorize";
import manual from "@/content/instagram.json";
import overrides from "@/content/instagram-overrides.json";

// Official route: Instagram API with Instagram Login (graph.instagram.com).
// The old Basic Display API was shut down by Meta on 4 Dec 2024, so don't use it.
// Needs a long-lived token for a Business/Creator account (INSTAGRAM_ACCESS_TOKEN).
// Long-lived tokens last 60 days; refresh with
//   GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=TOKEN

const GRAPH = "https://graph.instagram.com/v23.0";
const FIELDS =
  "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{media_type}";

type GraphMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: "FEED" | "REELS" | "STORY" | "AD";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  children?: { data: { id: string }[] };
};

type Override = { category?: InstagramItem["category"]; brand?: string; carouselLabel?: string; hidden?: boolean };
const ov = overrides as Record<string, Override>;

function shortcode(permalink: string) {
  return permalink.match(/\/(?:reel|p|tv)\/([^/?#]+)/)?.[1] ?? permalink;
}

function applyOverride(item: InstagramItem): InstagramItem | null {
  const o = ov[shortcode(item.permalink)];
  if (!o) return item;
  if (o.hidden) return null;
  return { ...item, ...o };
}

function fromGraph(m: GraphMedia): InstagramItem | null {
  const caption = m.caption ?? "";
  const isCarousel = m.media_type === "CAROUSEL_ALBUM";
  const isVideo = m.media_type === "VIDEO";
  if (!isCarousel && !isVideo) return null; // plain photos aren't part of this showcase
  return {
    id: m.id,
    kind: isCarousel ? "carousel" : "reel",
    permalink: m.permalink,
    caption,
    videoUrl: isVideo ? m.media_url : undefined,
    thumbnailUrl: isVideo ? m.thumbnail_url : m.media_url,
    slideCount: m.children?.data.length,
    category: categorize(caption, isCarousel),
    carouselLabel: isCarousel ? carouselLabel(caption) : undefined,
    brand: detectBrand(caption),
    timestamp: m.timestamp,
  };
}

async function fetchGraph(token: string): Promise<{ items: InstagramItem[]; followers?: number }> {
  const items: InstagramItem[] = [];
  let url: string | null = `${GRAPH}/me/media?fields=${encodeURIComponent(FIELDS)}&limit=50&access_token=${token}`;
  // Cap at 4 pages (~200 posts) to keep build/revalidate fast.
  for (let page = 0; url && page < 4; page++) {
    const res: Response = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Instagram API ${res.status}: ${await res.text()}`);
    const json: { data: GraphMedia[]; paging?: { next?: string } } = await res.json();
    for (const m of json.data) {
      const item = fromGraph(m);
      if (item) items.push(item);
    }
    url = json.paging?.next ?? null;
  }

  let followers: number | undefined;
  try {
    const me = await fetch(`${GRAPH}/me?fields=followers_count&access_token=${token}`, {
      next: { revalidate: 3600 },
    });
    if (me.ok) followers = (await me.json()).followers_count;
  } catch {}

  return { items, followers };
}

function fromManual(): InstagramItem[] {
  return (manual as Omit<InstagramItem, "id">[]).map((m, i) => ({
    id: `manual-${i}`,
    ...m,
    category: m.category ?? categorize(m.caption ?? "", m.kind === "carousel"),
    carouselLabel: m.kind === "carousel" ? m.carouselLabel ?? carouselLabel(m.caption ?? "") : undefined,
    brand: m.brand ?? detectBrand(m.caption ?? ""),
  }));
}

export async function getInstagram() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  let items: InstagramItem[] = [];
  let followers: number | undefined;
  let source: "api" | "manual" = "manual";

  if (token) {
    try {
      const r = await fetchGraph(token);
      items = r.items;
      followers = r.followers;
      source = "api";
    } catch (e) {
      console.error("[instagram] falling back to manual content:", e);
    }
  }
  if (source === "manual") items = fromManual();

  const final = items.map(applyOverride).filter((x): x is InstagramItem => x !== null);
  return {
    reels: final.filter((i) => i.kind === "reel"),
    carousels: final.filter((i) => i.kind === "carousel"),
    followers,
    source,
  };
}

export function embedUrl(permalink: string) {
  const clean = permalink.split("?")[0].replace(/\/$/, "");
  return `${clean}/embed/captioned/`;
}

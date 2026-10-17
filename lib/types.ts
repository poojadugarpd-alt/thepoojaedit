export type ReelCategory = "brand" | "affiliate" | "ugc" | "carousel";

export type InstagramItem = {
  id: string;
  /** "reel" | "carousel" | "image" */
  kind: "reel" | "carousel" | "image";
  permalink: string;
  caption: string;
  /** Direct mp4 (Graph API only). Used for the muted autoplay preview. */
  videoUrl?: string;
  thumbnailUrl?: string;
  slideCount?: number;
  category: ReelCategory;
  /** Carousel-specific label: Educational, Brand, Lifestyle, UGC, Promotional */
  carouselLabel?: string;
  brand?: string;
  timestamp?: string;
  /** True for seed/placeholder entries that ship with the template. */
  sample?: boolean;
};

export type YouTubeVideo = {
  id: string;
  title: string;
  thumbnailUrl: string;
  /** Seconds. Only available when YOUTUBE_API_KEY is set. */
  durationSec?: number;
  publishedAt?: string;
  isShort: boolean;
};

export type GraphicCategory =
  | "Thumbnail"
  | "Poster"
  | "Social Creative"
  | "Brand Graphic"
  | "Event Creative";

export type GraphicItem = {
  id: string;
  title: string;
  category: GraphicCategory;
  /** Path under /public or absolute URL. Omit to render a styled placeholder. */
  image?: string;
  alt: string;
  /** Aspect ratio, e.g. "16/9", "4/5", "1/1". */
  ratio?: string;
  sample?: boolean;
};

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  sample?: boolean;
};

export type Stats = {
  instagramFollowers?: number;
  youtubeSubscribers?: number;
  youtubeVideos?: number;
};

export type ShowcaseData = {
  reels: InstagramItem[];
  carousels: InstagramItem[];
  longForm: YouTubeVideo[];
  shorts: YouTubeVideo[];
  graphics: GraphicItem[];
  testimonials: Testimonial[];
  stats: Stats;
  sources: { instagram: "api" | "manual"; youtube: "api" | "rss" | "manual" };
};

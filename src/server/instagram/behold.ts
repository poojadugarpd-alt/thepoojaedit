import "server-only";

/**
 * Instagram feed via Behold.so (https://behold.so).
 *
 * Behold connects the owner's @poojadugar_ Professional account to Meta once and
 * exposes a plain JSON feed at `https://feeds.behold.so/<FEED_ID>`, with images
 * rehosted on Behold's CDN (so the URLs don't expire like raw Graph API media).
 * We render it with our own markup — no third-party script, no iframe, no
 * cookies, so no consent gate.
 *
 * Every failure path returns `null`; the homepage strip then shows its curated
 * product fallback. It is safe to deploy before `BEHOLD_FEED_ID` is set.
 */
import { z } from "zod";

import { env } from "@/lib/env";

const SizeSchema = z.object({
  mediaUrl: z.string().url(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

const PostSchema = z.object({
  id: z.string().min(1),
  permalink: z.string().url(),
  mediaType: z.string().optional(),
  prompt: z.string().optional(), // Behold's alt text, when the owner sets one
  caption: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  sizes: z.record(z.string(), SizeSchema).optional(),
});

const FeedSchema = z.object({
  username: z.string().optional(),
  posts: z.array(PostSchema).default([]),
});

export interface InstagramPost {
  id: string;
  permalink: string;
  imageUrl: string;
  width: number;
  height: number;
  alt: string;
}

export interface InstagramFeed {
  username: string;
  posts: InstagramPost[];
}

const FEED_BASE = "https://feeds.behold.so/";

function pickImage(post: z.infer<typeof PostSchema>) {
  const s = post.sizes ?? {};
  const isVideo = (post.mediaType ?? "").toUpperCase() === "VIDEO";
  const size = isVideo
    ? undefined
    : s.medium || s.large || s.small || s.full;
  if (size) {
    return { url: size.mediaUrl, width: size.width ?? 640, height: size.height ?? 640 };
  }
  if (post.thumbnailUrl) {
    return { url: post.thumbnailUrl, width: 640, height: 640 };
  }
  const any = s.large || s.medium || s.full || s.small;
  return any
    ? { url: any.mediaUrl, width: any.width ?? 640, height: any.height ?? 640 }
    : null;
}

/**
 * The most recent posts, or `null` if the feed is unset, unreachable, slow,
 * malformed or empty. Cached for an hour.
 */
export async function getInstagramFeed(): Promise<InstagramFeed | null> {
  const feedId = env.BEHOLD_FEED_ID;
  if (!feedId) return null;

  let json: unknown;
  try {
    const res = await fetch(FEED_BASE + encodeURIComponent(feedId), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }

  const parsed = FeedSchema.safeParse(json);
  if (!parsed.success) return null;

  const posts: InstagramPost[] = [];
  for (const p of parsed.data.posts) {
    const img = pickImage(p);
    if (!img) continue;
    posts.push({
      id: p.id,
      permalink: p.permalink,
      imageUrl: img.url,
      width: img.width,
      height: img.height,
      alt:
        p.prompt?.trim() ||
        p.caption?.trim().replace(/\s+/g, " ").slice(0, 120) ||
        "Instagram post from @poojadugar_",
    });
    if (posts.length >= 12) break;
  }

  if (posts.length < 3) return null;
  return { username: parsed.data.username ?? "poojadugar_", posts };
}

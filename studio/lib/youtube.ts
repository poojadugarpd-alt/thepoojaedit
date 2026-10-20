import "server-only";
import type { YouTubeVideo } from "./types";

// Channel @poojadugar → UCOQihhIzR63mQL3PT1PI-pQ. Every channel has two auto playlists:
//   UULF<id>  = long-form uploads      UUSH<id> = Shorts
// With YOUTUBE_API_KEY we read them through the Data API v3 (adds durations, more items,
// subscriber count). Without a key we read YouTube's public RSS feed for the same
// playlists, which needs no auth but returns only the latest 15 of each.

const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || "UCOQihhIzR63mQL3PT1PI-pQ";
const base = CHANNEL_ID.slice(2);
const LONG = `UULF${base}`;
const SHORTS = `UUSH${base}`;
const API = "https://www.googleapis.com/youtube/v3";
const REVALIDATE = { next: { revalidate: 3600 } };

function isoToSeconds(iso: string) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

async function apiPlaylist(key: string, playlistId: string, isShort: boolean, max = 50) {
  const res = await fetch(
    `${API}/playlistItems?part=contentDetails&maxResults=${max}&playlistId=${playlistId}&key=${key}`,
    REVALIDATE,
  );
  if (!res.ok) throw new Error(`YouTube playlistItems ${res.status}`);
  const ids: string[] = (await res.json()).items.map((i: any) => i.contentDetails.videoId);
  if (!ids.length) return [];

  const vres = await fetch(
    `${API}/videos?part=snippet,contentDetails&id=${ids.join(",")}&key=${key}`,
    REVALIDATE,
  );
  if (!vres.ok) throw new Error(`YouTube videos ${vres.status}`);
  return (await vres.json()).items.map(
    (v: any): YouTubeVideo => ({
      id: v.id,
      title: v.snippet.title,
      thumbnailUrl: v.snippet.thumbnails?.maxres?.url ?? v.snippet.thumbnails?.high?.url ?? thumb(v.id),
      durationSec: isoToSeconds(v.contentDetails.duration),
      publishedAt: v.snippet.publishedAt,
      isShort,
    }),
  );
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function rssPlaylist(playlistId: string, isShort: boolean): Promise<YouTubeVideo[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`, REVALIDATE);
  if (!res.ok) throw new Error(`YouTube RSS ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const id = e.match(/<yt:videoId>([^<]+)/)![1];
    return {
      id,
      title: decode(e.match(/<title>([^<]*)/)?.[1] ?? ""),
      thumbnailUrl: thumb(id),
      publishedAt: e.match(/<published>([^<]+)/)?.[1],
      isShort,
    };
  });
}

async function subscribers(key: string) {
  try {
    const r = await fetch(`${API}/channels?part=statistics&id=${CHANNEL_ID}&key=${key}`, REVALIDATE);
    const s = (await r.json()).items?.[0]?.statistics;
    return s
      ? { youtubeSubscribers: Number(s.subscriberCount), youtubeVideos: Number(s.videoCount) }
      : {};
  } catch {
    return {};
  }
}

export async function getYouTube() {
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    try {
      const [longForm, shorts, stats] = await Promise.all([
        apiPlaylist(key, LONG, false),
        apiPlaylist(key, SHORTS, true),
        subscribers(key),
      ]);
      return { longForm, shorts, stats, source: "api" as const };
    } catch (e) {
      console.error("[youtube] API failed, trying RSS:", e);
    }
  }
  try {
    const [longForm, shorts] = await Promise.all([rssPlaylist(LONG, false), rssPlaylist(SHORTS, true)]);
    return { longForm, shorts, stats: {}, source: "rss" as const };
  } catch (e) {
    console.error("[youtube] RSS failed:", e);
    return { longForm: [], shorts: [], stats: {}, source: "manual" as const };
  }
}

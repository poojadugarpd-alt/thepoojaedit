// Lists public/reels/*.mp4 into content/reel-videos.json at build time.
// (Workers have no filesystem at runtime, so lib/instagram.ts reads this list instead.)
import { readdirSync, writeFileSync } from "node:fs";

const files = readdirSync("public/reels").filter((f) => f.endsWith(".mp4"));
const codes = files.map((f) => f.replace(/\.mp4$/, "")).sort();
writeFileSync("content/reel-videos.json", JSON.stringify(codes, null, 2) + "\n");
console.log(`[reel-videos] ${codes.length} reel video(s) found`);

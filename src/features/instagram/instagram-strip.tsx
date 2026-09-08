import "server-only";

import Image from "next/image";
import Link from "next/link";

import { getInstagramFeed } from "@/server/instagram/behold";

const PROFILE = "https://www.instagram.com/poojadugar_/";

export interface StripTile {
  /** PDP path for a curated tile. */
  href: string;
  imageUrl: string;
  alt: string;
}

/**
 * Homepage "On Instagram" strip. Progressive enhancement (design/DESIGN.md AS6):
 * the live Behold feed replaces the curated product fallback when it is
 * available; a token/API failure just shows the fallback. Server-rendered — no
 * client script, no iframe.
 */
export async function InstagramStrip({ fallback }: { fallback: StripTile[] }) {
  const feed = await getInstagramFeed().catch(() => null);
  const live = feed?.posts ?? [];
  const isLive = live.length >= 3;

  if (!isLive && fallback.length < 3) return null;

  return (
    <section className="u-section u-rule">
      <div className="u-page flex items-end justify-between gap-4">
        <div>
          <a
            href={PROFILE}
            target="_blank"
            rel="noreferrer noopener"
            className="u-eyebrow underline-offset-2 hover:underline"
          >
            @poojadugar_
          </a>
          <h2 className="u-h2 mt-3">
            {isLive ? "Latest on Instagram" : "On Instagram"}
          </h2>
        </div>
        <a
          href={PROFILE}
          target="_blank"
          rel="noreferrer noopener"
          className="u-pill shrink-0"
        >
          Follow
        </a>
      </div>

      <div className="u-page mt-10">
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {isLive
            ? live.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <a
                    href={p.permalink}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={p.alt}
                    className="u-media block aspect-square"
                  >
                    <Image
                      src={p.imageUrl}
                      alt=""
                      width={p.width}
                      height={p.height}
                      sizes="(max-width: 640px) 33vw, 15vw"
                      className="h-full w-full object-cover"
                    />
                  </a>
                </li>
              ))
            : fallback.slice(0, 6).map((t, i) => (
                <li key={`${t.href}:${i}`}>
                  <Link href={t.href} className="u-media block aspect-square">
                    <Image
                      src={t.imageUrl}
                      alt={t.alt}
                      width={320}
                      height={320}
                      sizes="(max-width: 640px) 33vw, 15vw"
                      className="h-full w-full object-cover"
                    />
                  </Link>
                </li>
              ))}
        </ul>
        <p className="u-eyebrow mt-4">
          {isLive
            ? "Live from @poojadugar_ · refreshed hourly"
            : "A few pieces we've shared on @poojadugar_"}
        </p>
      </div>
    </section>
  );
}

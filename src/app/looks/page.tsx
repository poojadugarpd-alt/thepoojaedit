import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { listPublishedLooks } from "@/server/looks";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Looks",
  description:
    "Shop the looks from Pooja Dugar's Instagram: the Label and Closet pieces from each Reel, in one place.",
  alternates: { canonical: "/looks" },
};

export default async function LooksPage() {
  const looks = await listPublishedLooks(prisma);
  // Nothing published yet: no empty page for shoppers or Google.
  if (looks.length === 0) notFound();

  return (
    <div className="u-page py-14 sm:py-20">
      <p className="u-eyebrow">From Instagram</p>
      <h1 className="u-display mt-5">Looks</h1>
      <ul className="mt-12 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {looks.map((l) => (
          <li key={l.slug}>
            <Link href={`/looks/${l.slug}`} className="group flex flex-col">
              <div className="u-card-panel">
                {l.cover && (
                  <Image
                    src={l.cover.url}
                    alt={l.cover.alt}
                    fill
                    sizes="(max-width: 640px) 50vw, 320px"
                    className="object-cover transition-opacity duration-300 group-hover:opacity-90"
                  />
                )}
              </div>
              <h2 className="u-label mt-3.5">{l.title}</h2>
              <p className="mt-1 text-[0.85rem] text-ink-soft">
                {l.pieceCount} {l.pieceCount === 1 ? "piece" : "pieces"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

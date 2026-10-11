import "server-only";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db";

import { getStylingContent } from "./content";

/** Cache tag for anything that shows or hides with the /styling page. */
export const STYLING_TAG = "styling";

/**
 * Whether /styling is switched on, for the footer, About and the home page
 * link (D-162). Cached and busted by `revalidateTag(STYLING_TAG)` when the
 * page is saved; a database hiccup just hides the links, never breaks a page.
 */
export const isStylingPublished = unstable_cache(
  async (): Promise<boolean> => {
    try {
      return (await getStylingContent(prisma)).published;
    } catch {
      return false;
    }
  },
  ["styling-published"],
  { tags: [STYLING_TAG], revalidate: 3600 },
);

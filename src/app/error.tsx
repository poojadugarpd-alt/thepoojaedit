"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Catches a runtime error anywhere below the root layout — header/footer
 * still render, since this sits alongside layout.tsx, not inside it. Was
 * previously missing entirely, so any thrown error fell through to Next's
 * generic "Application error: a server-side exception has occurred" screen
 * with nothing but a digest — exactly what the owner hit during the D-111
 * incident (found during a full site pass, 2026-09-14, after that cause was
 * already fixed — this is the page a *future* error would still land on).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="u-page py-14 sm:py-20">
      <div className="max-w-[62ch]">
        <p className="u-eyebrow">Something went wrong</p>
        <h1 className="u-display mt-4">That didn&rsquo;t load right.</h1>
        <p className="u-lead mt-5">
          This is on us, not something you did. Try again, or head back to
          the shop — if it keeps happening, message{" "}
          <a
            href="https://www.instagram.com/poojadugar_/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            @poojadugar_
          </a>{" "}
          and mention what you were doing.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <button type="button" onClick={reset} className="u-pill">
            Try again
          </button>
          <Link href="/" className="u-textlink">
            Back to shop
          </Link>
        </div>
        {error.digest && (
          <p className="u-cap mt-10 text-ink-soft">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}

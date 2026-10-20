"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function remaining(endsAt: number, now: number): string {
  const total = Math.max(0, Math.floor((endsAt - now) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`;
}

/**
 * The sale line in the announcement bar, counting down to `endsAt`. Shows the
 * usual line again once the sale is over (the server stops pricing it then).
 * The time is only filled in after mount, so the server and browser render the
 * same markup.
 */
export function SaleCountdown({
  endsAt,
  text,
  href,
  fallback,
}: {
  endsAt: string;
  text: string;
  href: string;
  fallback: string;
}) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now != null && now >= end) return <>{fallback}</>;

  return (
    <Link href={href} className="underline-offset-2 hover:underline">
      <span className="whitespace-nowrap">{text}</span>
      <span className="hidden sm:inline"> · </span>
      {/* Phones: the countdown gets its own line rather than splitting the offer. */}
      <span className="block whitespace-nowrap sm:inline" aria-live="off">
        {"Ends in "}
        <span className="tabular-nums">{now == null ? "—" : remaining(end, now)}</span>
      </span>
    </Link>
  );
}

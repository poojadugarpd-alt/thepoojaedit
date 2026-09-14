"use client";

/**
 * Catches an error in the root layout itself (e.g. the header or footer
 * throwing) — the one case `error.tsx` can't handle, since it sits inside
 * the same layout it would need to replace. Must render its own complete
 * <html>/<body>: the root layout is exactly what failed, so nothing above
 * this can be trusted to still work. Deliberately plain inline styles, not
 * Tailwind classes or `globals.css` — this is the last line of defence, and
 * shouldn't depend on anything that might be part of what broke.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#ffffff",
          color: "#403e39",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "440px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            The Pooja Edit
          </p>
          <h1 style={{ fontSize: "28px", marginTop: "16px", fontWeight: 600 }}>
            Something went wrong loading the site.
          </h1>
          <p style={{ marginTop: "16px", lineHeight: 1.6, color: "#6a6762" }}>
            This is on us. Please reload the page, or message{" "}
            <a href="https://www.instagram.com/poojadugar_/" style={{ color: "inherit" }}>
              @poojadugar_
            </a>{" "}
            if it keeps happening.
          </p>
          {/* Deliberately a plain <a>, not next/link — the App Router's own
              client-side routing is exactly the kind of thing that might be
              part of what broke, so this reload has to work without it. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: "24px",
              padding: "10px 24px",
              borderRadius: "999px",
              background: "#403e39",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Reload the site
          </a>
          {error.digest && (
            <p style={{ marginTop: "24px", fontSize: "12px", color: "#6a6762" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}

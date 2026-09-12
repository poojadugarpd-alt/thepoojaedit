import { StandaloneStatus } from "@/features/admin/standalone-status";

export const metadata = { title: "Install on iPhone" };

// Vercel's stable production alias (D-97) — the real, live app, just not yet
// on thepoojaedit.in (D-94 hasn't cut the domain over from the owner's
// existing Shopify store). This is the one honest answer to "what do I type
// into Safari right now" until that cutover happens.
const CURRENT_URL = "https://thepoojaedit.vercel.app/admin";

export default function AdminInstallPage() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-strong">Install on iPhone</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Adds a Pooja Admin icon to your Home Screen, separate from The Pooja Edit
          shop icon, that opens straight into the admin — full screen, no browser
          address bar.
        </p>
      </div>

      <StandaloneStatus />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Steps
        </h2>
        <ol className="list-inside list-decimal space-y-3 text-sm text-ink">
          <li>
            Open <strong className="font-mono text-xs">{CURRENT_URL}</strong> in{" "}
            <strong>Safari</strong> and sign in.
          </li>
          <li>
            Tap the <strong>Share</strong> icon (the square with an arrow pointing up) in
            the toolbar.
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>. (Since iOS 16.4 some
            other browsers offer this too, but Safari is the one every step here was
            checked against.)
          </li>
          <li>
            The name will already say <strong>Pooja Admin</strong> — leave it, so it
            doesn&rsquo;t get confused with the shop app, then tap <strong>Add</strong>.
          </li>
          <li>
            Open it from the Home Screen icon (beige, with the maroon monogram) from now
            on, not from a browser bookmark.
          </li>
        </ol>
      </section>

      <section className="space-y-2 rounded border border-stop/30 bg-stop-bg/40 p-3">
        <h2 className="text-sm font-semibold text-stop">
          You will need to reinstall once, later
        </h2>
        <p className="text-sm text-ink">
          Right now this only exists at the address above. When{" "}
          <span className="font-mono text-xs">thepoojaedit.in</span> is switched over
          from the current Shopify store to this app, that&rsquo;s a different address as
          far as your iPhone is concerned — the icon you add today won&rsquo;t start
          pointing at the new address by itself. Delete it and add it again from{" "}
          <span className="font-mono text-xs">thepoojaedit.in/admin</span> once that
          happens. You&rsquo;ll be told when it&rsquo;s time.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          What&rsquo;s different once installed
        </h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink">
          <li>Its own icon and app-switcher entry — separate from the shop.</li>
          <li>Opens straight to the dashboard, no address bar or Safari tabs.</li>
          <li>Faster on a slow connection (see below) — everything else still needs the internet.</li>
          <li>Push notifications, once turned on in Settings — the icon has to be installed first; a browser tab can&rsquo;t receive them.</li>
        </ul>
        <p className="text-xs text-ink-soft">
          This is still a website running inside its own window, not a native app —
          there is nothing to review or approve in the App Store, and no separate
          download. Nothing works offline except a plain &ldquo;no connection&rdquo; screen — every
          real screen (orders, stock, prices) always needs the internet, on purpose.
        </p>
      </section>
    </div>
  );
}

import Link from "next/link";

/**
 * Shared shell for the low-frequency content pages (about, contact, size guide,
 * policies). Rhode-cut styling; an optional "draft" banner for pages whose text
 * is adapted from the legacy sites and still needs the owner's sign-off.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  draft,
  children,
}: {
  eyebrow?: string;
  title: string;
  updated?: string;
  draft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="u-page py-14 sm:py-20">
      <div className="max-w-[62ch]">
        {eyebrow && <p className="u-eyebrow">{eyebrow}</p>}
        <h1 className="u-display mt-4">{title}</h1>
        {updated && <p className="u-cap mt-4 text-ink-soft">Last updated {updated}</p>}

        {draft && (
          <p className="mt-6 rounded-[10px] border border-line bg-fill px-4 py-3 text-sm text-ink">
            Draft — this text is adapted from our previous stores and is being
            finalised. For anything time-sensitive, message{" "}
            <a
              href="https://www.instagram.com/poojadugar_/"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
            >
              @poojadugar_
            </a>
            .
          </p>
        )}

        <div className="mt-10 space-y-5 text-[0.95rem] leading-relaxed text-ink [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:text-ink-strong [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-[0.06em] [&_h2]:text-[0.8125rem] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>

        <p className="mt-14 border-t border-line pt-6 text-sm">
          <Link href="/" className="u-textlink">
            Back to shop
          </Link>
        </p>
      </div>
    </div>
  );
}

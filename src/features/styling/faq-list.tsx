import Link from "next/link";

import type { Faq } from "./guides";

/**
 * Questions and answers on /styling and its guide pages. Each answer folds
 * under its question (native <details>, no JavaScript), so a long list stays
 * short to scroll; the answers are still in the HTML for search engines and
 * the FAQPage JSON-LD.
 */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="mt-8 max-w-[70ch] border-b border-line">
      {faqs.map((f) => (
        <details key={f.q} className="group border-t border-line">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-ink-strong [&::-webkit-details-marker]:hidden">
            <span className="text-lg leading-snug">{f.q}</span>
            <span
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-xl leading-none text-ink-soft transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="pb-6 text-ink">
            {f.a}
            {f.link && (
              <>
                {" "}
                <Link href={f.link.href} className="underline underline-offset-2">
                  {f.link.label}
                </Link>
                .
              </>
            )}
          </p>
        </details>
      ))}
    </div>
  );
}

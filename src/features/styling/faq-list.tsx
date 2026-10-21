import Link from "next/link";

import type { Faq } from "./guides";

/** Questions and answers on /styling and its guide pages. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <dl className="mt-10 grid max-w-[70ch] gap-8">
      {faqs.map((f) => (
        <div key={f.q} className="border-t border-line pt-6">
          <dt className="u-h3">{f.q}</dt>
          <dd className="mt-3 text-ink">
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
          </dd>
        </div>
      ))}
    </dl>
  );
}

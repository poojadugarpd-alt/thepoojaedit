import Image from "next/image";

import {
  DESTINATIONS,
  GOOD_TO_KNOW,
  INTERNATIONAL_OPTIONS,
  INTERNATIONAL_STEPS,
  LIFESTYLE_IMAGE,
  SOURCE_LIST,
  todayInIndia,
  tripState,
  type Destination,
} from "./international";
import { stylingWhatsAppUrl } from "./whatsapp";

/**
 * "International Personal Shopping" on /styling. All copy, images and trip
 * dates live in ./international.ts; this file is layout only. Server
 * component, no JavaScript: "Good to know" is a native <details>.
 */

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

const listUrl = (place: string) =>
  stylingWhatsAppUrl(`Hi Pooja, I'd like to send you a shopping list for ${place}.`);

const GENERAL_WHATSAPP = stylingWhatsAppUrl(
  "Hi Pooja, I'd like to know more about international personal shopping.",
);

// Tall enough to tap comfortably on a phone (44px+).
const BUTTON = "u-pill min-h-11 w-full justify-center px-4 text-center sm:w-auto";

export function InternationalShopping() {
  const today = todayInIndia();
  const live = DESTINATIONS.filter((d) => tripState(d, today) !== "none");
  const upcoming = DESTINATIONS.filter((d) => tripState(d, today) === "none");
  const places = DESTINATIONS.map((d) => d.name);

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "International personal shopping",
    serviceType: "Personal shopping",
    description:
      "Pooja Dugar shops for you abroad, in Vietnam, Singapore, Dubai, China and Japan, from your list and budget, with photo options to approve before buying.",
    provider: { "@type": "Person", name: "Pooja Dugar" },
    areaServed: places.map((name) => ({ "@type": "Country", name })),
  };

  return (
    <section
      id="international"
      className="u-section u-rule scroll-mt-24"
      aria-labelledby="international-heading"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <div className="u-page">
        {/* 1. Heading and intro */}
        <div
          className={
            LIFESTYLE_IMAGE
              ? "grid gap-10 sm:grid-cols-[1fr_minmax(0,20rem)] sm:items-end"
              : undefined
          }
        >
          <div>
            <p className="u-eyebrow">International personal shopper</p>
            <h2 id="international-heading" className="u-h2 mt-4">
              International Personal Shopping
            </h2>
            <p className="mt-4 max-w-[62ch] text-ink-strong">
              Personal shopping in Vietnam, Singapore, Dubai, China and Japan, curated
              for your style, budget and travel dates.
            </p>
            <p className="mt-4 max-w-[62ch] text-ink">
              Need something from Vietnam, Singapore, Dubai, China, or Japan? I can shop
              for you while I am travelling, according to your preferences, your budget,
              and the pieces you have been looking for. Whether you live in India or
              abroad, send me your list and I&rsquo;ll shop for you abroad.
            </p>
          </div>
          {LIFESTYLE_IMAGE && (
            <div className="u-media relative aspect-[4/5]">
              <Image
                src={LIFESTYLE_IMAGE.src}
                alt={LIFESTYLE_IMAGE.alt}
                fill
                sizes="(min-width: 640px) 20rem, 100vw"
                className="object-cover"
              />
            </div>
          )}
        </div>

        {/* 6. Destinations (shown early: the live trip is the news) */}
        <h3 className="u-label mt-12">Where I&rsquo;m shopping</h3>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {live.map((d) => (
            <li key={d.slug} className="col-span-2 lg:row-span-2">
              <FeaturedCard d={d} state={tripState(d, today)} />
            </li>
          ))}
          {upcoming.map((d) => (
            <li key={d.slug}>
              <UpcomingCard d={d} />
            </li>
          ))}
        </ul>

        {/* 2. Two ways to work together */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2">
          {INTERNATIONAL_OPTIONS.map((o, i) => (
            <div key={o.title} className="border-t border-line pt-6">
              <p className="u-eyebrow">Option {i + 1}</p>
              <h3 className="u-h3 mt-3">{o.title}</h3>
              <p className="mt-3 text-ink">{o.text}</p>
            </div>
          ))}
        </div>

        {/* 3. What I can source */}
        <div className="mt-14 border-t border-line pt-6">
          <h3 className="u-label">What I can source</h3>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-ink sm:grid-cols-3">
            {SOURCE_LIST.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        {/* 4. How it works */}
        <div className="mt-14 border-t border-line pt-6">
          <h3 className="u-label">How international shopping works</h3>
          <ol className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {INTERNATIONAL_STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="u-eyebrow">Step {i + 1}</span>
                <p className="mt-3 font-medium text-ink-strong">{s.title}</p>
                <p className="mt-2 text-ink">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* 5. Terms */}
        <details className="group mt-14 border-y border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-4 text-ink-strong [&::-webkit-details-marker]:hidden">
            <span className="u-label">Good to know</span>
            <span
              aria-hidden="true"
              className="text-xl leading-none text-ink-soft transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <ul className="grid gap-x-10 gap-y-2 pb-6 text-sm text-ink sm:grid-cols-2">
            {GOOD_TO_KNOW.map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden="true" className="text-ink-soft">
                  ·
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </details>

        {/* 7. Closing call to action */}
        <div className="mt-14 rounded-[var(--radius-media)] bg-fill px-6 py-10 sm:px-10">
          <h3 className="u-h2">Send Your List</h3>
          <p className="mt-4 max-w-[58ch] text-ink">
            Share what you are looking for, your budget, and any reference images. I will
            let you know what I can source during my upcoming travels.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#enquire" className={BUTTON}>
              Send Your List
            </a>
            <a
              href={GENERAL_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BUTTON} u-pill--ghost`}
            >
              WhatsApp Now
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function DestinationImage({ d, className }: { d: Destination; className: string }) {
  return (
    <div className={`u-media relative ${className}`}>
      {d.image ? (
        <Image
          src={d.image}
          alt={d.alt}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-end p-4 text-2xl tracking-tight text-ink-strong sm:text-3xl"
        >
          {d.name}
        </span>
      )}
    </div>
  );
}

function FeaturedCard({ d, state }: { d: Destination; state: "open" | "closed" | "none" }) {
  const trip = d.trip!;
  return (
    <article className="flex h-full flex-col rounded-[var(--radius-media)] bg-ink-strong p-5 text-ground sm:p-8">
      {d.image ? (
        <div className="u-media relative mb-6 aspect-[16/10]">
          <Image
            src={d.image}
            alt={d.alt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <p
          aria-hidden="true"
          className="mb-8 text-5xl leading-none tracking-tight sm:text-7xl"
        >
          {d.name}
        </p>
      )}
      <div className="mt-auto" />
      <p className="u-eyebrow !text-ground">
        {state === "open" ? `Now booking · ${d.name}` : `In ${d.name} now`}
      </p>
      <h3 className="mt-4 text-2xl leading-tight sm:text-3xl">{trip.headline}</h3>
      <p className="mt-4 opacity-90">{trip.text}</p>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-ground/25 pt-5 text-sm">
        <div>
          <dt className="opacity-75">Trip dates</dt>
          <dd className="mt-1 font-medium">{trip.dates}</dd>
        </div>
        <div>
          <dt className="opacity-75">{state === "open" ? "Send your list by" : "Lists closed"}</dt>
          <dd className="mt-1 font-medium">{longDate(trip.listsBy)}</dd>
        </div>
      </dl>
      <p className="mt-5 text-xs opacity-75">
        Subject to availability, budget, and item size/weight.
      </p>
      <div className="pt-6">
        <a
          href={listUrl(d.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="u-pill min-h-11 w-full justify-center !bg-ground !text-ink-strong sm:w-auto"
        >
          WhatsApp Now
        </a>
      </div>
    </article>
  );
}

function UpcomingCard({ d }: { d: Destination }) {
  return (
    <article className="flex h-full flex-col">
      <DestinationImage d={d} className="aspect-square" />
      <p className="u-eyebrow mt-4 !text-[0.6875rem]">Upcoming destination</p>
      <h3 className="mt-2 text-lg text-ink-strong">{d.name} personal shopper</h3>
      <p className="mt-1 text-sm text-ink">Personal shopping in {d.name}, coming soon.</p>
      <div className="mt-auto pt-4">
        <a
          href={listUrl(d.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="u-pill u-pill--ghost min-h-11 w-full justify-center px-3 text-sm"
        >
          Send Your List
        </a>
      </div>
    </article>
  );
}

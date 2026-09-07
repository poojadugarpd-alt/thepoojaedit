import Link from "next/link";

const CATALOGS = [
  {
    href: "/the-pooja-edit",
    name: "The Pooja Edit",
    blurb:
      "Original, new apparel — sizes, colours and restocked pieces from the studio.",
  },
  {
    href: "/thrift",
    name: "Thrift Store",
    blurb:
      "Pre-loved and one-of-one. Each piece listed with condition, measurements and flaws.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          One brand, two ways to shop
        </h1>
        <p className="mt-4 text-black/70 dark:text-white/70">
          Pick a catalogue to start. Your cart can hold pieces from both, and each item
          keeps its own return policy at checkout.
        </p>
      </section>

      <section aria-label="Catalogues" className="mt-12 grid gap-6 sm:grid-cols-2">
        {CATALOGS.map((catalog) => (
          <Link
            key={catalog.href}
            href={catalog.href}
            className="group rounded-lg border border-black/10 p-6 transition-colors hover:border-black/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/15 dark:hover:border-white/40"
          >
            <h2 className="text-xl font-medium group-hover:underline underline-offset-4">
              {catalog.name}
            </h2>
            <p className="mt-2 text-sm text-black/70 dark:text-white/70">
              {catalog.blurb}
            </p>
            <span className="mt-4 inline-block text-sm font-medium">
              Shop {catalog.name} →
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}

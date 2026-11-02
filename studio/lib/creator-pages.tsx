import type { ReactNode } from "react";
import { pricing, site } from "./site";
import type { Faq } from "./services";

// Copy for /how-to-become-a-ugc-creator and /fashion-creators, approved by the owner on
// 2026-11-02. Facts come from her own answers: 40k+ followers, the brands below, her
// prices from lib/site.ts. Do not add numbers or brand names she has not given.

const p = pricing;

/** Brands the owner said can be named (2026-11-02). Spelling as she wrote it. */
export const creatorBrands = [
  "off duty",
  "miraggio",
  "lavie",
  "bluer",
  "gehen sarees",
  "hues studio",
  "soak & sage",
  "arkya official",
  "aza fashion",
  "select staples",
  "rivr",
  "perfora",
  "paco modamo",
  "poppi clothing",
  "bellavita",
  "invogue",
  "underneat",
  "amazon",
];

export const brandList = `${creatorBrands.slice(0, -1).join(", ")} and ${creatorBrands.at(-1)}`;

export type CreatorSection = {
  id: string;
  heading: string;
  /** "blush" shades the band, to alternate with plain ones. */
  tone?: "blush";
  body: ReactNode;
};

export type CreatorPageData = {
  path: string;
  kicker: string;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  answer: string;
  crumb: string;
  schemaType: "Article" | "Service";
  schemaName: string;
  whatsappMessage: string;
  sections: CreatorSection[];
  faqs: Faq[];
  updated: string;
};

const IG = (
  <a className="text-link" href={site.instagramUrl} target="_blank" rel="noopener">
    {site.instagramHandle}
  </a>
);

export const ugcGuidePage: CreatorPageData = {
  path: "/how-to-become-a-ugc-creator",
  kicker: "guide · for new creators",
  seoTitle: "How to Become a UGC Creator in India | Pooja Dugar",
  seoDescription:
    "How to become a UGC creator in India: what to film, how to build a portfolio, how to pitch brands and why a clean edit helps you get hired.",
  h1: "how to become a ugc creator in india",
  answer:
    "a ugc creator makes videos of a product that a brand then uses on its own page or in its ads. to start, pick one niche, film three sample videos with products you already own, edit them so they look finished, and send them to small brands. i have 40k+ followers on instagram and make ugc for fashion and lifestyle brands, so this is what i'd do if i were starting today.",
  crumb: "how to become a ugc creator",
  schemaType: "Article",
  schemaName: "How to become a UGC creator in India",
  whatsappMessage: "Hi Pooja! I'd like my UGC samples edited.",
  updated: "2026-11-02",
  sections: [
    {
      id: "who",
      heading: "who this comes from",
      tone: "blush",
      body: (
        <p className="service-answer">
          i&rsquo;m pooja dugar, a fashion creator ({IG}, 40k+ followers). i earn from affiliate sales,
          brand deals and ugc, and my first brand work started when a brand messaged me after seeing my
          reels. i&rsquo;ve made videos for {brandList}.
        </p>
      ),
    },
    {
      id: "paying",
      heading: "what brands are paying for",
      body: (
        <p className="service-answer">
          a brand hires a ugc creator for a clip it can run as an ad. the footage has to be usable: clear
          light, steady framing, clean sound and a length that fits the platform. brands look at your
          audience and at your video, and in my experience they weigh both about equally, so work on both.
        </p>
      ),
    },
    {
      id: "steps",
      heading: "the steps",
      tone: "blush",
      body: (
        <ol className="page-list">
          <li>pick one niche you can talk about without notes, like fashion, skincare or home.</li>
          <li>
            film three samples with things you own: a try-on or unboxing, how you actually use the product,
            and a close-up of the detail that sells it. use natural light as much as you can. morning light
            shows the true colour of a fabric.
          </li>
          <li>
            edit them. add captions, cut the dead air and fix the sound. a clip that looks finished is
            easier for a brand to say yes to.
          </li>
          <li>
            put the samples in one place, such as an instagram highlight or a folder link, so a brand can
            open everything from one message.
          </li>
          <li>
            pitch small brands directly. keep the message short, attach your best sample, and say your
            videos are product focused. that wording works well with brands.
          </li>
          <li>
            when a brand replies, ask about the product and what they want from the video before you talk
            price. then quote per video and say what&rsquo;s included: how many revisions, and where the
            brand can use the clip.
          </li>
        </ol>
      ),
    },
    {
      id: "mistake",
      heading: "the mistake i see most",
      body: (
        <p className="service-answer">
          poor light and sound. a good idea shot in a dim room with an echo is hard to save in editing, so
          fix those two first.
        </p>
      ),
    },
    {
      id: "help",
      heading: "how i can help with the edit",
      tone: "blush",
      body: (
        <p className="service-answer">
          send me your raw clips and i&rsquo;ll cut them into reels, shorts or ads in 9:16, 4:5 or square.
          reels start at {p.reels.amount} and take {p.reels.turnaround}, with 1&ndash;2 revisions included.
          i also do discounted packages that depend on the type of work and the volume. message me on
          whatsapp with your footage and what you want it to look like. see{" "}
          <a className="text-link" href="/fashion-creators">
            reel editing for fashion creators
          </a>{" "}
          and{" "}
          <a className="text-link" href="/pricing">
            all prices
          </a>
          .
        </p>
      ),
    },
  ],
  faqs: [
    {
      q: "do i need a lot of followers?",
      a: "brands look at your audience and your video about equally. a smaller account with clean, product focused samples can still get hired.",
    },
    {
      q: "do i need a good camera?",
      a: "a recent phone is enough if the light is good. film near a window.",
    },
    { q: "how many samples should i have?", a: "three to five, all in the same niche." },
    {
      q: "can you edit my samples?",
      a: `yes, from ${p.reels.amount} a reel. send them on whatsapp.`,
    },
    {
      q: "can you shoot ugc for my brand instead?",
      a: "yes. shoots are quoted on request. see ugc and brand videos at /ugc.",
    },
  ],
};

export const fashionCreatorsPage: CreatorPageData = {
  path: "/fashion-creators",
  kicker: "for fashion creators · reels",
  seoTitle: "Reel Editor for Fashion Creators in India | Pooja Dugar",
  seoDescription: `A fashion creator with 40k+ followers edits your reels: try-ons, hauls, outfit videos and affiliate content. Reels from ${p.reels.amount}, ready in 24 to 48 hours.`,
  h1: "reel editing for fashion creators",
  answer: `i'm a fashion creator who edits reels for other fashion and lifestyle creators. send me raw try-on, haul, outfit or affiliate footage and i'll cut it with captions, sound and transitions. reels start at ${p.reels.amount} and are ready in ${p.reels.turnaround}.`,
  crumb: "reel editing for fashion creators",
  schemaType: "Service",
  schemaName: "Reel editing for fashion creators",
  whatsappMessage: "Hi Pooja! I'd like my fashion reels edited.",
  updated: "2026-11-02",
  sections: [
    {
      id: "work",
      heading: "see the work",
      tone: "blush",
      body: (
        <p className="service-answer">
          my own reels are on {IG} (40k+ followers). i&rsquo;ve made videos for {brandList}.
        </p>
      ),
    },
    {
      id: "edit",
      heading: "what i edit",
      body: (
        <p className="service-answer">
          try-on and haul reels, outfit of the day, get ready with me, styling reels, affiliate and brand
          collaboration videos, and the carousels and graphics that go with them. i&rsquo;m flexible on the
          type of work and the fabric.
        </p>
      ),
    },
    {
      id: "why",
      heading: "why a fashion creator edits better fashion videos",
      tone: "blush",
      body: (
        <p className="service-answer">
          i make fashion content for my own instagram. a try-on reel works when the fit is shown clearly,
          the fabric gets a close-up and the first two seconds hold attention. i cut for that.
        </p>
      ),
    },
    {
      id: "how",
      heading: "how it works",
      body: (
        <ol className="page-list">
          <li>
            message me on whatsapp with your raw clips, a few reels you like, your captions and the music
            you want. a clear brief saves the most time.
          </li>
          <li>i confirm the plan and the price before i start.</li>
          <li>the edit comes back in {p.reels.turnaround} for standard reels.</li>
          <li>1&ndash;2 rounds of changes are included.</li>
        </ol>
      ),
    },
    {
      id: "refs",
      heading: "references and timing",
      tone: "blush",
      body: (
        <p className="service-answer">
          references can be recreated but not replicated. i&rsquo;ll match the pacing and the captions of
          reels you like, in my own edit. creativity takes time, so leave enough of it in hand, especially
          for heavier edits.
        </p>
      ),
    },
    {
      id: "price",
      heading: "price",
      body: (
        <p className="service-answer">
          reels start at {p.reels.amount} for simple cuts and captions. the price changes with the design
          and the work involved. heavier motion graphics, colour grading and stronger hook editing are
          quoted per project. i also do discounted packages that depend on the type of work and the volume,
          so message me for a monthly plan.{" "}
          <a className="text-link" href="/pricing">
            all prices
          </a>
          . new to ugc?{" "}
          <a className="text-link" href="/how-to-become-a-ugc-creator">
            here&rsquo;s how to become a ugc creator
          </a>
          .
        </p>
      ),
    },
  ],
  faqs: [
    {
      q: "do you edit affiliate reels?",
      a: "yes. brand and affiliate videos are part of the reel service.",
    },
    {
      q: "can you copy a reel i like?",
      a: "i can recreate the look, not replicate it. send two or three reels and tell me what to keep. i'll match the pacing and captions within the starter price.",
    },
    {
      q: "why does the price change?",
      a: `design changes the work. simple cuts and captions start at ${p.reels.amount}, and motion graphics or grading are quoted per project.`,
    },
    {
      q: "how long does an edit take?",
      a: `standard reels take ${p.reels.turnaround}. heavier or more creative edits take longer, so plan for it.`,
    },
    {
      q: "can you edit youtube videos too?",
      a: `yes, from ${p.youtube.amount} a video with a thumbnail and shorts clippings.`,
    },
    { q: "do you shoot as well?", a: "yes, i shoot and edit ugc. shoots are quoted on request." },
  ],
};

/**
 * Styling guide pages under /styling/<slug>, and the questions on /styling
 * itself. Copy written with the owner and approved 2026-10-21 (D-175); facts
 * come from her answers that day, so change them only with her.
 *
 * The fee table on the cost guide and the NRI page is read live from Admin →
 * Styling, but the cost guide's opening answer quotes her fees in words, so
 * update it when she changes them.
 */

export interface GuideLink {
  href: string;
  label: string;
}

export interface Faq {
  q: string;
  a: string;
  link?: GuideLink;
}

export type GuideSection =
  | { kind: "text"; heading: string; paras: string[]; link?: GuideLink }
  | { kind: "list"; heading: string; items: string[]; after?: string }
  | { kind: "steps"; heading: string; items: string[] }
  /** Pooja's live offers from Admin → Styling, then an optional extra line. */
  | { kind: "fees"; heading: string; extra?: string; after?: string }
  /** The testimonials she shows on /styling. */
  | { kind: "testimonials"; heading: string };

export interface Guide {
  slug: string;
  /** Search title, used as is (no brand suffix). */
  title: string;
  description: string;
  /** Short name for links and the breadcrumb. */
  name: string;
  eyebrow: string;
  h1: string;
  answer: string;
  sections: GuideSection[];
  faqs: Faq[];
  /** Adds Service JSON-LD for pages that describe a service. */
  service?: { name: string; areaServed: "worldwide" | "ncr" };
}

const PLACES =
  "Ambience Mall and DLF Mega Mall in Gurugram, DLF Emporio and Select Citywalk in South Delhi, the markets at Shahpur Jat, Lajpat Nagar, Mehrauli, Chandni Chowk and Karol Bagh, and designer studios and boutiques for wedding and festive wear.";

export const COST_GUIDE: GuideLink = {
  href: "/styling/personal-stylist-cost",
  label: "How much a personal stylist costs",
};
export const NRI_GUIDE: GuideLink = {
  href: "/styling/nri",
  label: "Shopping in India from abroad",
};
export const WEDDING_GUIDE: GuideLink = {
  href: "/styling/wedding-shopping",
  label: "Wedding and trousseau shopping",
};

export const guides: Guide[] = [
  {
    slug: "nri",
    title: "Personal Shopper in India for NRIs | Pooja Dugar",
    description:
      "Shop Indian wear from abroad with Pooja Dugar. Live video-call shopping in Delhi NCR, custom pieces, alterations and courier to Australia, UK, USA, UAE.",
    name: "Shopping from abroad",
    eyebrow: "For clients abroad",
    h1: "Your personal shopper in India, wherever you live",
    answer:
      "I'm Pooja Dugar, a fashion designer and stylist based in Delhi NCR. Most of my clients live outside India, in Australia, the UK and Europe, the USA and Canada, and the UAE. I shop for them in Delhi and Gurugram over a video call, get pieces made or altered to their measurements, and send everything by courier.",
    service: {
      name: "Personal shopping in India for clients abroad",
      areaServed: "worldwide",
    },
    sections: [
      {
        kind: "steps",
        heading: "How it works when you're abroad",
        items: [
          "Send me an enquiry with the occasion, your size, your budget and a few pictures you like.",
          "We have a short call and agree the plan and my fee before anything starts.",
          "I go to the stores and show you pieces live on a video call, or I send you a shortlist of photos on WhatsApp. You pick.",
          "I get the pieces altered to your measurements here in India, so they fit when they reach you.",
          "I pack everything and send it by courier. You pay the shipping.",
        ],
      },
      {
        kind: "list",
        heading: "What I can shop for",
        items: [
          "Wedding outfits and trousseau: lehengas, sarees, sherwanis and outfits for every function",
          "Festive wear for Diwali, Eid, Karva Chauth and family events",
          "Everyday Indian and Indo-western wear you can't find where you live",
          "Custom pieces I design and get made, especially Indian ethnic wear",
          "Menswear and outfits for the whole family (quote on request)",
        ],
      },
      { kind: "text", heading: "Where I shop", paras: [PLACES] },
      {
        kind: "fees",
        heading: "What it costs",
        extra: "Courier: paid by you, at the courier's rate for your country.",
        after:
          "We agree my fee before I start. The clothes are paid for separately: when you're abroad, I buy them and you pay me back what they cost.",
      },
      { kind: "testimonials", heading: "From my clients" },
    ],
    faqs: [
      {
        q: "Can you shop for me in India if I live abroad?",
        a: "Yes. Most of my clients live abroad. I shop on a video call or send photo shortlists on WhatsApp, and courier the pieces to you.",
      },
      {
        q: "Which countries do you ship to?",
        a: "My clients are mostly in Australia, the UK and Europe, the USA and Canada, and the UAE. If you're somewhere else, ask me.",
      },
      {
        q: "Who pays for shipping and customs?",
        a: "You pay the courier charges. Import duty depends on your country's rules, and you pay that too.",
      },
      {
        q: "Can you get outfits made to my measurements?",
        a: "Yes. I design custom pieces and get them made, and I have shop-bought pieces altered before they're sent.",
      },
      {
        q: "How do I send my measurements?",
        a: "I'll send you a simple measurement guide. Or measure a piece you own that fits you well, and send me those.",
      },
      {
        q: "How long does it take?",
        a: "It depends on what we're shopping for and whether pieces are being made. We agree the timeline on our first call.",
      },
      {
        q: "Can you shop for my wedding from abroad?",
        a: "Yes: outfits for the bride, the family and every function, planned on calls before you travel.",
        link: WEDDING_GUIDE,
      },
    ],
  },
  {
    slug: "personal-stylist-cost",
    title: "Personal Stylist Cost in Delhi NCR (₹5,000–₹50,000)",
    description:
      "How much does a personal or fashion stylist cost in Delhi NCR? Online sessions start near ₹1,000; shopping in person is ₹10,000–₹50,000. See what's included.",
    name: "What it costs",
    eyebrow: "Fees",
    h1: "How much does a personal stylist cost in Delhi NCR?",
    answer:
      "In Delhi NCR, personal stylists charge anything from about ₹1,000 for a short online consultation to ₹10,000 or more for a few hours of shopping in person, and more for a full wardrobe. My fees are ₹5,000 to ₹10,000 for a new wardrobe and accessories, and ₹10,000 to ₹50,000 for personal shopping in person. Styling with what you already own is priced on request.",
    sections: [
      {
        kind: "list",
        heading: "What changes the price",
        items: [
          "Time: an hour online costs less than a day out shopping.",
          "Going to the stores with you costs more than a video call.",
          "A few outfits cost less than a whole new wardrobe.",
          "Designing and making a piece is quoted separately.",
          "For clients abroad, the courier is extra.",
        ],
      },
      { kind: "fees", heading: "My fees" },
      {
        kind: "text",
        heading:
          "Stylist, personal shopper or image consultant: what's the difference?",
        paras: [
          "A personal stylist works out what suits you and puts outfits together, often from what you already own. A personal shopper goes to the stores and buys for you or with you. An image consultant looks at the whole picture: clothes, colours, grooming and how you come across. I do the first two, and as a fashion designer I can also make pieces for you.",
        ],
      },
      {
        kind: "text",
        heading: "Is a personal stylist worth it?",
        paras: [
          "It usually is if you keep buying things you don't wear, or if a wedding or a move is coming up. You end up buying fewer pieces that you actually wear. We always start with what you own and shop only for what's missing.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the cost of clothes included in the fee?",
        a: "No. In person, you pay the stores directly. If you're abroad, I buy for you and you pay me back what the clothes cost.",
      },
      {
        q: "Do you charge commission on what I buy?",
        a: "No. You pay my fee and the price of the clothes, nothing more.",
      },
      {
        q: "Can I book an online session instead?",
        a: "Yes, over a video call, from anywhere.",
        link: NRI_GUIDE,
      },
      { q: "Do you style men?", a: "Yes, quote on request." },
    ],
  },
  {
    slug: "wedding-shopping",
    title: "Wedding & Trousseau Shopping Stylist in Delhi | Pooja Dugar",
    description:
      "Wedding, trousseau and festive outfit shopping in Delhi NCR with designer Pooja Dugar: for brides, families and NRI clients, with custom pieces and fittings.",
    name: "Wedding shopping",
    eyebrow: "Weddings",
    h1: "Wedding and trousseau shopping in Delhi, with a designer",
    answer:
      "I help brides and their families shop for weddings in Delhi NCR: the trousseau, outfits for each function, and pieces for parents and siblings. I'm a fashion designer, so when the right piece doesn't exist I can design it and get it made. Many of my wedding clients live abroad and shop with me over video calls.",
    service: { name: "Wedding and trousseau shopping", areaServed: "ncr" },
    sections: [
      {
        kind: "list",
        heading: "What I help with",
        items: [
          "The bride's outfits for every function, planned so nothing repeats or clashes",
          "The trousseau: sarees, suits and everyday Indian wear for after the wedding",
          "Outfits for the groom, parents, siblings and close family (quote on request)",
          "Custom pieces, designed by me and made to measure",
          "Fittings and alterations before the wedding, or before shipping abroad",
        ],
      },
      {
        kind: "steps",
        heading: "How we plan it",
        items: [
          "A call to list every function, the dress code and your budget",
          "A shortlist of looks and where to find them",
          "Shopping days together, in person or on video",
          "Fittings, alterations, and a final check of every outfit",
        ],
      },
      {
        kind: "text",
        heading: "Where we shop",
        paras: [
          "Designer studios and boutiques, the wedding markets of Chandni Chowk, Karol Bagh, Shahpur Jat and Mehrauli, Lajpat Nagar, and malls like DLF Emporio, Select Citywalk and Ambience Mall.",
        ],
      },
      {
        kind: "text",
        heading: "Shopping from abroad for a wedding in India?",
        paras: [
          "Start two or three months before. We plan on calls, I shop and shortlist for you, and pieces are altered and either couriered to you or ready when you land.",
        ],
        link: NRI_GUIDE,
      },
    ],
    faqs: [
      { q: "How early should I start?", a: "Two to three months before the wedding." },
      { q: "Do you shop for the whole family?", a: "Yes, quote on request." },
      { q: "Can you make my outfit?", a: "Yes, custom pieces are quoted separately." },
      {
        q: "What does it cost?",
        a: "My fees are on the cost page, and we agree yours before anything starts.",
        link: COST_GUIDE,
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}

/** Where Pooja works, shown on /styling. */
export const WHERE_I_WORK =
  "In person in Gurugram, Delhi and Noida. Online, worldwide: most of my clients live in Australia, the UK and Europe, the USA and Canada, and the UAE.";

export const STYLING_LINKS: GuideLink[] = [NRI_GUIDE, WEDDING_GUIDE, COST_GUIDE];

/** The questions on /styling. */
export const stylingFaqs: Faq[] = [
  {
    q: "How much does a personal stylist cost in Delhi NCR?",
    a: "Stylists in Delhi NCR charge from about ₹1,000 for a short online session to ₹10,000 or more for shopping in person. My fees are listed above, and we agree yours before anything starts.",
    link: COST_GUIDE,
  },
  {
    q: "Can you shop for me if I live abroad?",
    a: "Yes. Most of my clients live abroad. I shop over a video call or send photo shortlists on WhatsApp, have pieces altered here, and courier them to you.",
    link: NRI_GUIDE,
  },
  {
    q: "What happens in a styling session?",
    a: "We start with what you own, agree what's missing, then shop for it.",
  },
  {
    q: "What's the difference between a stylist, a personal shopper and an image consultant?",
    a: "A stylist works out what suits you and puts outfits together. A personal shopper buys for you or with you. An image consultant also covers colours, grooming and how you come across. I do the first two, and as a designer I can make pieces for you too.",
  },
  { q: "Do you style men?", a: "Yes, quote on request." },
  { q: "Can we do it online?", a: "Yes, over a video call." },
  { q: "Which areas do you cover in person?", a: "Gurugram, Delhi and Noida." },
];

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
export const ONLINE_GUIDE: GuideLink = {
  href: "/styling/online",
  label: "Online personal styling",
};
export const SHOPPER_GUIDE: GuideLink = {
  href: "/styling/personal-shopper-india",
  label: "Personal shopping in India",
};
/** The custom-made section on /styling (SEO plan X1, 2026-10-30). */
export const CUSTOM_LINK: GuideLink = {
  href: "/styling#custom",
  label: "Custom-made clothes, designed and tailored for you",
};

export const guides: Guide[] = [
  {
    slug: "nri",
    title: "Personal Stylist & Shopper in India for NRIs | Pooja Dugar",
    description:
      "Shop Indian wear from abroad with a Delhi stylist. Video-call shopping, custom pieces, fittings and courier to the UK, USA, Australia and UAE.",
    name: "Shopping from abroad",
    eyebrow: "For clients abroad",
    h1: "Your personal stylist and shopper in India, for NRIs and clients abroad",
    answer:
      "I'm Pooja Dugar, a fashion designer and stylist based in Delhi NCR. Most of my clients are NRIs and others living outside India, in Australia, the UK and Europe, the USA and Canada, and the UAE. I style and shop for them in Delhi and Gurugram over a video call, get pieces made or altered to their measurements, and send everything by courier.",
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
        kind: "text",
        heading: "Custom-made pieces from India",
        paras: [
          "If the right outfit doesn't exist, I design it or coordinate it with tailors, to your measurements. Custom work is explained in the custom-made section of my styling page, including measuring from abroad, fittings and courier.",
        ],
        link: CUSTOM_LINK,
      },
      {
        kind: "text",
        heading: "Measuring from abroad",
        paras: [
          "I send you a simple measurement guide. Or measure a garment you own that fits you well and send me those numbers. I check fit here in India with fittings, so pieces arrive ready to wear.",
        ],
      },
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
        q: "What is an NRI personal shopper?",
        a: "A personal shopper in India who shops and styles for people who live abroad. I shop on a video call or send photos, have pieces altered, and courier everything to you.",
      },
      {
        q: "Do you style me, or only shop for me?",
        a: "Both. We plan outfits first, then I shop for what's missing.",
      },
      {
        q: "Can I get custom Indian clothes made from abroad?",
        a: "Yes. I design or coordinate custom pieces to your measurements, fit them here, and courier them to you.",
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
    title: "NRI Wedding Shopping in India | Pooja Dugar",
    description:
      "Wedding and trousseau shopping in Delhi for NRI brides and families: outfits, fittings, custom pieces and shipping abroad, planned from afar.",
    name: "Wedding shopping",
    eyebrow: "Weddings",
    h1: "Wedding and trousseau shopping in India, for NRI brides and families",
    answer:
      "I help brides and their families shop for weddings in India: the trousseau, outfits for each function, and pieces for parents and siblings. I'm a fashion designer, so when the right piece doesn't exist I can design it and get it made. Many of my clients are NRIs who plan everything with me over video calls before they travel.",
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
      {
        q: "Can you plan an NRI wedding wardrobe from abroad?",
        a: "Yes. We plan on calls, I shop and shortlist for you, pieces are altered here, and everything is couriered to you or ready when you land. Start two to three months before.",
        link: NRI_GUIDE,
      },
      { q: "Do you shop for the whole family?", a: "Yes, quote on request." },
      { q: "Can you make my outfit?", a: "Yes, custom pieces are quoted separately." },
      {
        q: "What does it cost?",
        a: "My fees are on the cost page, and we agree yours before anything starts.",
        link: COST_GUIDE,
      },
    ],
  },
  {
    slug: "online",
    title: "Online Personal Stylist in India | Pooja Dugar",
    description:
      "Work with a personal stylist in India over video call. Wardrobe edits, outfit planning and shopping from anywhere. Enquire for a plan and fee.",
    name: "Online styling",
    eyebrow: "Online styling",
    h1: "Online personal styling with Pooja, from anywhere",
    answer:
      "I style clients over video call and WhatsApp, in India and abroad. We go through what you own, agree what's missing, and plan outfits for the occasions you have coming up. If you want to shop, I can shop for you or with you on the same call.",
    service: { name: "Online personal styling", areaServed: "worldwide" },
    sections: [
      {
        kind: "list",
        heading: "What an online session covers",
        items: [
          "Going through your wardrobe, from photos or on camera, and keeping what works",
          "Outfit planning for events, travel and everyday wear",
          "A list of what's missing, in order of what matters most",
          "Shopping for those pieces with you on video, or sending a shortlist on WhatsApp",
          "Custom pieces, if the right one doesn't exist",
        ],
        after: "Custom-made clothes are explained on my styling page.",
      },
      {
        kind: "steps",
        heading: "How it works",
        items: [
          "Send an enquiry with the occasion, your size, your budget and a few pictures you like.",
          "We have a short call and agree the plan and my fee before anything starts.",
          "You send photos of what you own, or show me on camera.",
          "We plan the looks, and I shop for the gaps if you want me to.",
          "Anything I buy is altered in India and sent by courier. You pay the courier.",
        ],
      },
      {
        kind: "text",
        heading: "What to have ready",
        paras: [
          "Photos of your wardrobe in daylight, a few full-length pictures of you, your measurements or a garment that fits well, and a note on the occasions you're dressing for. Don't worry if you have only some of these. We start with what you have.",
        ],
      },
      {
        kind: "text",
        heading: "Online or in person?",
        paras: [
          "In Gurugram, Delhi and Noida I also style and shop in person. Everywhere else, we work online. If you live outside India, my page for clients abroad explains how shopping, alterations and courier work.",
        ],
        link: NRI_GUIDE,
      },
    ],
    faqs: [
      {
        q: "How does an online styling session work?",
        a: "We have a video call, go through what you own and what you need, and agree a plan. If you want me to shop, I do that on a call or send you photos on WhatsApp.",
      },
      {
        q: "Do I need to send photos of my wardrobe?",
        a: "It helps, but you can also show me on camera. We start with whatever you have.",
      },
      {
        q: "Can we shop together on a video call?",
        a: "Yes. I go to the stores and show you pieces live, or send a shortlist of photos on WhatsApp. You pick.",
      },
      {
        q: "What does online styling cost?",
        a: "My fees are on the cost page, and we agree yours before anything starts.",
        link: COST_GUIDE,
      },
      {
        q: "Can you style me if I live outside India?",
        a: "Yes. Most of my clients live abroad. Anything I buy for you is altered in India and couriered to you.",
        link: NRI_GUIDE,
      },
      { q: "Do you style men?", a: "Yes, quote on request." },
    ],
  },
  {
    slug: "personal-shopper-india",
    title: "Personal Shopping Service in India | Pooja Dugar",
    description:
      "A personal shopper in Delhi for clients in India and abroad: curated edits, boutique and designer sourcing, video-call shopping and shipping.",
    name: "Personal shopping",
    eyebrow: "Personal shopping",
    h1: "A personal shopping service in India, built around you",
    answer:
      "A personal shopper finds, compares and buys clothes for you or with you. I shop in Delhi NCR for clients who live here and for clients who live abroad, from malls and boutiques to markets and designer studios.",
    service: { name: "Personal shopping in India", areaServed: "ncr" },
    sections: [
      {
        kind: "list",
        heading: "What personal shopping with me includes",
        items: [
          "A curated shortlist for your occasion, size and budget",
          "Boutique and designer sourcing, including pieces you can't find online",
          "Shopping together in person, or live on a video call",
          "Alterations so pieces fit before they reach you",
          "A quality check on every piece",
          "Courier coordination for clients abroad",
        ],
      },
      { kind: "text", heading: "Where I shop", paras: [PLACES] },
      {
        kind: "steps",
        heading: "How it works",
        items: [
          "Send an enquiry with what you're looking for, your size, your budget and pictures you like.",
          "We have a short call and agree the plan and my fee.",
          "I shop and show you a shortlist, in person, on video, or as photos on WhatsApp.",
          "You choose. I get pieces altered if they need it.",
          "In person, you pay the stores. When you're abroad, I buy and you pay me back what the clothes cost, and I send everything by courier.",
        ],
      },
      {
        kind: "text",
        heading: "In person or from abroad",
        paras: [
          "In Gurugram, Delhi and Noida we can shop together. If you live abroad, I shop for you and we choose over video. My page for NRIs and clients abroad covers measurements, courier and import duty.",
        ],
        link: NRI_GUIDE,
      },
      {
        kind: "fees",
        heading: "What it costs",
        after:
          "We agree my fee before I start. The clothes are paid for separately.",
      },
    ],
    faqs: [
      {
        q: "What does a personal shopper do?",
        a: "A personal shopper finds and buys clothes for you or with you. I also style, so we look at how the pieces work together, and I can have things altered.",
      },
      {
        q: "How much does personal shopping cost?",
        a: "My fee is on this page and on the cost page. We agree it before I start, and the clothes are paid for separately.",
        link: COST_GUIDE,
      },
      {
        q: "Do you shop in markets as well as boutiques?",
        a: "Yes. Markets like Lajpat Nagar and Chandni Chowk, malls, boutiques and designer studios, depending on what you need.",
      },
      {
        q: "Can you shop for me when I'm not in India?",
        a: "Yes. I shop on a video call or send photos, and courier the pieces to you. You pay the courier and any import duty.",
        link: NRI_GUIDE,
      },
      { q: "Can I shop with you in person?", a: "Yes, in Gurugram, Delhi and Noida." },
      {
        q: "Do you shop for weddings?",
        a: "Yes, including trousseau and outfits for the family. Start two to three months before.",
        link: WEDDING_GUIDE,
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

export const STYLING_LINKS: GuideLink[] = [
  NRI_GUIDE,
  WEDDING_GUIDE,
  ONLINE_GUIDE,
  SHOPPER_GUIDE,
  COST_GUIDE,
];

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
  { q: "Can we do it online?", a: "Yes, over a video call.", link: ONLINE_GUIDE },
  {
    q: "Can you make an outfit to my measurements?",
    a: "Yes. I design custom pieces and get them made to your measurements. For some orders I coordinate with tailors and boutiques instead, and I tell you which route before we start.",
  },
  {
    q: "How do I measure myself for a custom order?",
    a: "I send you a simple measurement guide. Or measure a garment you own that fits well and send me those numbers.",
  },
  {
    q: "How long does a custom outfit take?",
    a: "It depends on the piece. We agree the timeline on our first call, before anything is made.",
  },
  {
    q: "Can custom pieces be shipped abroad?",
    a: "Yes. I pack the pieces after fittings and send them by courier. You pay the courier charges and any import duty your country charges.",
    link: NRI_GUIDE,
  },
  { q: "Which areas do you cover in person?", a: "Gurugram, Delhi and Noida." },
];

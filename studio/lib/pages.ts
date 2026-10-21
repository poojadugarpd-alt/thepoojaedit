import { pricing, type PriceKey } from "./site";
import type { Faq } from "./services";

// Copy for /pricing and /ugc, approved by the owner on 2026-10-21 (D-175). Same voice as the
// service pages; her prices come from lib/site.ts. The market ranges on /pricing are from
// Indian price guides (rs999.in, vidpros.com and others, Oct 2026), not her rates.

const p = pricing;

export const priceRows: PriceKey[] = ["reels", "youtube", "carousels", "graphics"];

export const pricingPage = {
  seoTitle: `Reel Editing Cost in India: From ${p.reels.amount} a Reel | Pooja Dugar`,
  seoDescription: `What Instagram Reel, YouTube and carousel editing cost in India in 2026, what changes the price, and Pooja Dugar's fixed rates: Reels from ${p.reels.amount}.`,
  h1: "how much does reel editing cost in india?",
  answer: `in india, a reel edit usually costs anywhere from a few hundred rupees to ₹8,000, depending on who edits it and how much work goes into it. a youtube video usually costs a few thousand rupees or more. my rates are fixed: ${p.reels.amount} ${p.reels.unit}, ${p.youtube.amount} per youtube video, ${p.carousels.amount} ${p.carousels.unit} and ${p.graphics.amount} ${p.graphics.unit}, with 1–2 revisions included.`,
  drivers: [
    "footage: a 30-second reel from three clips is quicker than one cut from an hour of raw footage.",
    "style: simple cuts and captions cost less than heavy motion graphics.",
    "revisions: most editors include one or two rounds and charge for more.",
    "rush jobs usually cost more.",
    "freelancers usually cost less than agencies, which also charge for strategy and account managers.",
  ],
  why: "i work on my own, so you talk directly to the person editing your video and there's no agency fee on top. i edit fashion and lifestyle content, the same kind i make for my own instagram.",
  monthly:
    "posting several reels a week? monthly and bulk work is priced to what you need. message me on whatsapp and we'll work it out.",
  faqs: [
    {
      q: `what's included in ${p.reels.amount}?`,
      a: "editing, captions, sound design, transitions and a file ready to post.",
    },
    {
      q: "how do i send footage?",
      a: "message me on whatsapp. send your raw clips, any reference videos, brand assets, captions and the music you'd like, and i'll confirm the plan before i start.",
    },
    { q: "can you edit from raw footage?", a: "yes." },
    { q: "do you work with brands?", a: "yes. i shoot and edit ugc and brand videos too." },
  ] satisfies Faq[],
};

export const ugcPage = {
  seoTitle: "UGC & Brand Video Editing for Fashion Brands | Pooja Dugar",
  seoDescription:
    "UGC and product video editing for fashion, beauty and lifestyle brands in India: Reels, ads and product videos, edited by fashion creator Pooja Dugar.",
  h1: "ugc and brand video editing for fashion and lifestyle brands",
  /** The brands line is added from the Reels on the site, so it only names brands shown there. */
  answer:
    "i shoot and edit ugc, product videos and reels for fashion, beauty and lifestyle brands. send me raw creator footage or your own shoot, and i'll cut it into reels, shorts and ads in 9:16, 4:5 or square.",
  edits: [
    "ugc videos from creators, cut for reels and ads",
    "product videos and launches",
    "lookbooks and styling reels",
    "carousels and graphics to go with them",
  ],
  why: "i make fashion content for my own instagram, so i know how long to hold a fabric close-up and how to pace a try-on so the fit shows.",
  price: `editing starts at ${p.reels.amount} ${p.reels.unit}. shoots, batches and monthly plans are priced to what you need, so message me on whatsapp.`,
  faqs: [
    {
      q: "do you shoot the videos too?",
      a: "yes. send me your own footage, or i can shoot the ugc for you. shoots are quoted on request.",
    },
    { q: "can you make different sizes for ads?", a: "yes: 9:16, 4:5 and square." },
    { q: "how fast?", a: `${p.reels.turnaround} per reel.` },
  ] satisfies Faq[],
};

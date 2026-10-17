// Single source for contact details and pricing. Edit here, nothing else needs to change.

const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919971572036";

export const site = {
  name: "Pooja Dugar",
  studio: "Pooja Dugar Studio",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  email: "poojadugar.pd@gmail.com",
  whatsappDisplay: "+91 99715 72036",
  whatsappNumber: waNumber,
  whatsappUrl: `https://wa.me/${waNumber}`,
  whatsappMessage: "Hi Pooja! I'd like to get some content edited.",
  instagramHandle: "@poojadugar_",
  instagramUrl: "https://instagram.com/poojadugar_",
  youtubeHandle: "@poojadugar",
  youtubeUrl: "https://youtube.com/@poojadugar",
};

export function waLink(message = site.whatsappMessage) {
  return `${site.whatsappUrl}?text=${encodeURIComponent(message)}`;
}

export type PriceKey = "reels" | "youtube" | "carousels" | "graphics";

export const pricing: Record<
  PriceKey,
  { service: string; amount: string; unit: string; includes: string; turnaround: string }
> = {
  reels: {
    service: "Instagram Reels",
    amount: "₹200",
    unit: "per Reel",
    includes: "Includes editing, captions, sound design, transitions, and platform-ready export.",
    turnaround: "24–48 hours",
  },
  youtube: {
    service: "YouTube Long Form",
    amount: "₹1,000",
    unit: "per video",
    includes: "Long-form edit, thumbnail, and Shorts clippings included.",
    turnaround: "2–3 days",
  },
  carousels: {
    service: "Instagram Carousels",
    amount: "₹200",
    unit: "per carousel",
    includes: "Includes slide design, captions, layout, and platform-ready export.",
    turnaround: "24–48 hours",
  },
  graphics: {
    service: "Graphics",
    amount: "₹500",
    unit: "per graphic",
    includes: "Includes custom design, brand-aligned layout, and export-ready files.",
    turnaround: "24–48 hours",
  },
};

export const serviceOptions = [
  "Instagram Reels",
  "YouTube Long Form",
  "Instagram Carousels",
  "Graphics",
  "Other",
] as const;

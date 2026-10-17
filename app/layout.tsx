import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  variable: "--font-display",
  display: "swap",
});
const body = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });

const description =
  "Instagram Reels, YouTube long-form, Shorts, carousels, and graphics — edited by Pooja Dugar. Reels from ₹200, YouTube from ₹1,000. Chat on WhatsApp.";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: "Pooja Dugar — Video Editing & Content Repurposing for Creators",
  description,
  openGraph: {
    title: "Cinematic edits for creators — Pooja Dugar",
    description,
    type: "website",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#0b0a09",
  colorScheme: "dark",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: site.studio,
  founder: { "@type": "Person", name: site.name },
  email: site.email,
  telephone: site.whatsappDisplay.replace(/\s/g, ""),
  url: site.url,
  areaServed: "IN",
  sameAs: [site.instagramUrl, site.youtubeUrl],
  makesOffer: [
    ["Instagram Reels editing", 200],
    ["YouTube long-form editing", 1000],
    ["Instagram carousel design", 200],
    ["Graphic design", 500],
  ].map(([name, price]) => ({
    "@type": "Offer",
    itemOffered: { "@type": "Service", name },
    price,
    priceCurrency: "INR",
  })),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
      <body>
        <a className="skip" href="#work">
          Skip to work
        </a>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}

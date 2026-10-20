import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Figtree } from "next/font/google";
import { site } from "@/lib/site";
import { studioJsonLd } from "@/lib/schema";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });

const description =
  "Instagram Reels, Shorts, YouTube, carousels and graphics for fashion and lifestyle creators and brands, edited by Pooja Dugar. Reels from ₹200, YouTube ₹1,000.";

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
  // Bing Webmaster Tools ownership (2026-10-20). Google is verified by DNS for the whole domain.
  verification: { other: { "msvalidate.01": "53874445B6A99C480CCD4BA92DA49862" } },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
      <body>
        <a className="skip" href="#top">
          Skip to content
        </a>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(studioJsonLd()) }}
        />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { EnvironmentBanner } from "@/components/environment-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import { publicEnv } from "@/lib/public-env";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "The Pooja Edit + Thrift Store",
    template: "%s · The Pooja Edit",
  },
  description:
    "One brand, two catalogs — The Pooja Edit for new apparel and the Thrift Store for pre-loved, one-of-one pieces.",
  applicationName: "The Pooja Edit",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-dvh flex-col antialiased`}
      >
        <SkipLink />
        <EnvironmentBanner />
        <SiteHeader />
        <main id="main-content" className="flex-1 focus:outline-none" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}

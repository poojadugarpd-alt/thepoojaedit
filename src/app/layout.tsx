import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AnnouncementTicker } from "@/components/announcement-ticker";
import { EnvironmentBanner } from "@/components/environment-banner";
import { RouteChrome } from "@/components/route-chrome";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import { publicEnv } from "@/lib/public-env";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "The Pooja Edit — by Pooja Dugar",
    template: "%s · The Pooja Edit",
  },
  description:
    "Realistic, wearable clothes by Pooja Dugar — pieces she designs, and one-of-one pieces from her own closet.",
  applicationName: "The Pooja Edit",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} flex min-h-dvh flex-col antialiased`}
      >
        <SkipLink />
        <RouteChrome
          storefront={
            <>
              <EnvironmentBanner />
              <AnnouncementTicker />
              <SiteHeader />
            </>
          }
        />
        <main id="main-content" className="flex-1 focus:outline-none" tabIndex={-1}>
          {children}
        </main>
        <RouteChrome storefront={<SiteFooter />} />
      </body>
    </html>
  );
}

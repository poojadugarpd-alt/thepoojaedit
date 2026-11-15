import type { Metadata } from "next";

// The styling pages get their own tab icon (a hanger) so they read as the
// styling service rather than the shop. Replaces the store icon on /styling
// and every guide under it; the rest of the site keeps the store icon.
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/brand/styling-icon.svg", type: "image/svg+xml" },
      { url: "/brand/styling-icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/brand/styling-icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/brand/styling-apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function StylingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

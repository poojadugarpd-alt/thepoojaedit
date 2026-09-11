import type { MetadataRoute } from "next";

// Brand icons only (public/brand/icon-192.png, icon-512.png) — the site's
// own colours stay white/white (D-96); maroon/beige are the logo's, not the
// app chrome's.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Pooja Edit",
    short_name: "Pooja Edit",
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
  };
}

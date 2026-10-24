import type { MetadataRoute } from "next";

// Lets phones install OpenTill to the home screen; public/sw.js makes the installed app open offline.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenTill",
    short_name: "OpenTill",
    description: "Point of sale",
    start_url: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

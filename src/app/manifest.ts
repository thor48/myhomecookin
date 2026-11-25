import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

// Makes the site installable ("Add to Home Screen") and, on Android,
// adds it to the share sheet so recipe links can be sent straight to /add.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME.length > 12 ? "Recipes" : SITE_NAME,
    description: "Recipes our friends and family love to make.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/add",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  } as MetadataRoute.Manifest;
}

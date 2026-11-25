import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for the Docker image (see Dockerfile).
  output: "standalone",
  // The release's commit, passed in by the Docker build. A page left open
  // from an older release then reloads when you move to another page.
  // Must be fixed for the whole build, so no fallback (next.config is read
  // more than once, and a timestamp would differ between reads).
  deploymentId: process.env.DEPLOYMENT_ID || undefined,
  cacheComponents: true,
  experimental: {
    // Recipe photos (resized in the browser) are sent to server actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
  partialPrefetching: true,
  // The service worker must never be cached, or phones keep running an old one.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

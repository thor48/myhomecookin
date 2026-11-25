import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for the Docker image (see Dockerfile).
  output: "standalone",
  cacheComponents: true,
  experimental: {
    // Recipe photos (resized in the browser) are sent to server actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
  partialPrefetching: true,
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

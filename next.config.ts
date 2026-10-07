import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads per-request cookies (locale, Supabase session), so we use
  // the regular dynamic rendering model instead of Cache Components.
  cacheComponents: false,
  // Lets `NEXT_DIST_DIR=.next-check next build` run without touching a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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

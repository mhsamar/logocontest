import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads per-request cookies (locale, Supabase session), so we use
  // the regular dynamic rendering model instead of Cache Components.
  cacheComponents: false,
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

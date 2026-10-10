import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads per-request cookies (locale, Supabase session), so we use
  // the regular dynamic rendering model instead of Cache Components.
  cacheComponents: false,
  // Headless Chrome for the Logo Research Certificate (owner, 2026-10-10): loaded from node_modules at run time,
  // not bundled, so the Chromium binary ships with the server function.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // The compressed Chromium files are read at run time, so they are added to the functions that make certificates.
  outputFileTracingIncludes: {
    "/api/logo-checks/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
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

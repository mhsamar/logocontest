import type { NextConfig } from "next";

/**
 * Security headers on every response (QA, 2026-10-18). Other sites may not show our pages in a frame (stops click
 * tricks on the login and payment pages); browsers must trust our file types; links to other sites carry only
 * "logocontest.bd", not the full address; camera, microphone and location stay off (the site never uses them).
 * HTTPS-only (HSTS) is already sent by Vercel.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Browsers and apps that ask for /favicon.ico get the site icon (QA, 2026-10-18); the icon itself is set in Admin.
  async redirects() {
    return [{ source: "/favicon.ico", destination: "/icon", permanent: false }];
  },
  // Every page reads per-request cookies (locale, Supabase session), so we use
  // the regular dynamic rendering model instead of Cache Components.
  cacheComponents: false,
  // ID and copy-claim photos go through forms (owner, 2026-10-10); the browser makes them small first.
  // Stays under the 4.5 MB request limit of the server functions.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Headless Chrome for the Logo Research Certificate (owner, 2026-10-10): loaded from node_modules at run time,
  // not bundled, so the Chromium binary ships with the server function.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // The compressed Chromium files are read at run time, so they are added to the functions that make certificates.
  outputFileTracingIncludes: {
    "/api/logo-checks/**": ["./node_modules/@sparticuz/chromium/bin/**"],
    // Win cards and monthly prize cards (owner, 2026-10-11) are pictures made the same way.
    "/api/cards/**": ["./node_modules/@sparticuz/chromium/bin/**"],
    // Contest cards (owner, 2026-10-19): drawn by the 15-minute job and by Admin › Contest cards.
    "/api/cron/lifecycle": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/admin/contest-cards": ["./node_modules/@sparticuz/chromium/bin/**"],
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

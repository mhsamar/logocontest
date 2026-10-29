"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/** Pages that never show ads (owner, 2026-10-14): the admin, people's own pages, sign-up, checkout and payments. */
const NO_ADS = ["/admin", "/dashboard", "/my-contests", "/pay", "/pro/checkout", "/start", "/start-v2", "/login", "/designers/signup", "/verify", "/reset-password", "/forgot-password", "/dev", "/notifications", "/support", "/r"];

export const adsAllowedOn = (path: string) => !NO_ADS.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Google AdSense (Auto ads) once the owner switches ads on in Admin › Settings › Ads. Loaded only when the visit
 * starts on a public page; AdSense places the ads itself, and its own settings can leave more pages out.
 */
export function AdsScript({ client }: { client: string }) {
  const path = usePathname();
  if (!adsAllowedOn(path)) return null;
  return <Script id="adsense" async strategy="afterInteractive" crossOrigin="anonymous" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`} />;
}

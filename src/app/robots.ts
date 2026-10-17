import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, searchIndexingOn, siteUrl } from "@/lib/seo";

/**
 * Link previews and Pinterest (owner, 2026-10-18): these robots only read a page when someone shares it or to check
 * the site is ours; they don't put pages in search results, so they may read the public pages even before launch.
 */
const SHARE_BOTS = ["Pinterestbot", "Pinterest", "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot", "WhatsApp", "TelegramBot"];

// robots.txt (BLUEPRINT §15.1): the private areas are blocked; a staging copy blocks everything but link previews.
export default function robots(): MetadataRoute.Robots {
  if (!searchIndexingOn())
    return {
      rules: [
        { userAgent: SHARE_BOTS, allow: "/", disallow: PRIVATE_PATHS },
        { userAgent: "*", disallow: "/" },
      ],
    };
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}

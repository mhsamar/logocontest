import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, searchIndexingOn, siteUrl } from "@/lib/seo";

// robots.txt (BLUEPRINT §15.1): the private areas are blocked; a staging copy blocks everything.
export default function robots(): MetadataRoute.Robots {
  if (!searchIndexingOn()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}

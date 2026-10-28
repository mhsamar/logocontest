import "server-only";
import { getSettings } from "@/lib/settings";
import { pictureUrl, siteImageUrl } from "./pictures";

export type BrandPictures = { logo: string | null; icon: string | null; hero: string | null; share: string | null };

/**
 * The pictures an admin uploaded (A-17); null means use the built-in one. The logo, icon and hero are shown on the
 * site's own pages, so they come through /api/site-img; the share picture is fetched by the share card, so it keeps
 * its public URL.
 */
export async function brandPictures(): Promise<BrandPictures> {
  const s = await getSettings(["brand.logo", "brand.icon", "brand.hero", "brand.share"]);
  return { logo: siteImageUrl(s["brand.logo"]), icon: siteImageUrl(s["brand.icon"]), hero: siteImageUrl(s["brand.hero"]), share: pictureUrl(s["brand.share"]) };
}

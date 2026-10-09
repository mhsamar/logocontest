import "server-only";
import { getSettings } from "@/lib/settings";
import { pictureUrl } from "./pictures";

export type BrandPictures = { logo: string | null; icon: string | null; hero: string | null; share: string | null };

/** Public URLs of the pictures an admin uploaded (A-17); null means use the built-in one. */
export async function brandPictures(): Promise<BrandPictures> {
  const s = await getSettings(["brand.logo", "brand.icon", "brand.hero", "brand.share"]);
  return { logo: pictureUrl(s["brand.logo"]), icon: pictureUrl(s["brand.icon"]), hero: pictureUrl(s["brand.hero"]), share: pictureUrl(s["brand.share"]) };
}

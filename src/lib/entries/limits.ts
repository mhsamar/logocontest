import "server-only";
import { isPro } from "@/lib/pro/status";
import { getSettings } from "@/lib/settings";

/** Mockups one design can have (owner, 2026-10-14): Admin › Settings, separately for Basic and Pro designers. */
export async function mockupLimit(designerId: string): Promise<number> {
  const [s, pro] = await Promise.all([getSettings(["limits.entry_max_images", "limits.entry_max_images_pro"]), isPro(designerId)]);
  return pro ? s["limits.entry_max_images_pro"] : s["limits.entry_max_images"];
}

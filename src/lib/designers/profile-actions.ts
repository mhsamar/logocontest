"use server";

import type { StudioFile } from "@/lib/studio/queries";
import { designerByUsername } from "./profile";
import { profileFiles } from "./public-profile";

/** "See more designs" and other tabs on the designer profile: files of more designs (only this designer's public ones). */
export async function loadProfileFiles(username: string, ids: string[]): Promise<Record<string, StudioFile[]> | null> {
  if (typeof username !== "string" || !Array.isArray(ids) || ids.length > 48 || !ids.every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))) return null;
  try {
    const designer = await designerByUsername(username);
    return designer ? await profileFiles(designer.id, ids) : null;
  } catch {
    return null;
  }
}

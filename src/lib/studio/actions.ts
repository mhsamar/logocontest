"use server";

import { listStudio, type StudioPage } from "./queries";
import { parseStudioQuery } from "./options";

/** "Load more designs" on the Design Studio: the next 24 for the same tab, search, business type and sort. */
export async function loadMoreStudio(query: Record<string, string>, offset: number): Promise<StudioPage | null> {
  if (!Number.isInteger(offset) || offset < 0 || offset > 100_000 || typeof query !== "object" || query === null) return null;
  try {
    return await listStudio(parseStudioQuery(query), offset);
  } catch {
    return null;
  }
}

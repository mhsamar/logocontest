"use server";

import { listStudio, type StudioPage } from "./queries";
import { parseStudioFilter } from "./options";

/** "Load more" on the Design Studio. */
export async function loadMoreStudio(filter: string, cursor: string): Promise<StudioPage | null> {
  // The cursor is a created_at value from the previous page, passed through unchanged (microseconds kept).
  if (typeof cursor !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(cursor)) return null;
  try {
    return await listStudio({ filter: parseStudioFilter(filter), before: cursor });
  } catch {
    return null;
  }
}

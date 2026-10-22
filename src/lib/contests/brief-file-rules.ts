/**
 * Reference files (C-07) are stored as `<contestId>/<uuid>.<ext>` in the private contest-files bucket. Pure rules,
 * shared by the wizard, Edit details (owner, 2026-10-22: photos on a live contest) and the admin card.
 */
export const BRIEF_FILE_EXT: Readonly<Record<string, string>> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };

const UUID_PART = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** A path we made for this contest, and (when the type is given) with that type's extension. */
export function isBriefPath(contestId: string, path: string, mime?: string): boolean {
  if (!new RegExp(`^${UUID_PART}$`, "i").test(contestId)) return false;
  const m = new RegExp(`^${contestId}/${UUID_PART}\\.(jpg|png|pdf)$`, "i").exec(path);
  if (!m) return false;
  return mime === undefined || BRIEF_FILE_EXT[mime] === m[1].toLowerCase();
}

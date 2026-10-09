/** The winner's final files (BLUEPRINT §9.3, owner 2026-10-08). Pure, shared by browser and server. */
export const HANDOVER_TYPES = ["ai", "eps", "svg", "pdf", "png", "jpg"] as const;
export type RequiredFileType = (typeof HANDOVER_TYPES)[number];
export type HandoverFileType = RequiredFileType | "extra";

export const MAX_EXTRA_FILES = 10;

/** Private bucket for the final files (migration 0022): any type up to 50 MB; extensions are checked here. */
export const HANDOVER_FILES_BUCKET = "handover-files";

const EXTENSIONS: Record<HandoverFileType, string[]> = {
  ai: ["ai"],
  eps: ["eps"],
  svg: ["svg"],
  pdf: ["pdf"],
  png: ["png"],
  jpg: ["jpg", "jpeg"],
  extra: ["ai", "eps", "svg", "pdf", "png", "jpg", "jpeg", "zip"],
};

export const extensionOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");

/** Whether a file with this name fits the slot (by extension). */
export function acceptsFile(type: HandoverFileType, name: string): boolean {
  return EXTENSIONS[type].includes(extensionOf(name));
}

/** The browser's file picker filter for a slot. */
export const acceptAttr = (type: HandoverFileType) => EXTENSIONS[type].map((e) => `.${e}`).join(",");

export const isHandoverType = (v: unknown): v is HandoverFileType => v === "extra" || (HANDOVER_TYPES as readonly string[]).includes(v as string);

export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export type HandoverStatus = "awaiting_files" | "submitted" | "revision_requested" | "approved" | "cancelled" | "no_result";

/** The four steps of the tracker (UI-JOURNEY C-17): picked → files → review → done. */
export function trackerStep(status: HandoverStatus): 1 | 2 | 3 | 4 {
  return status === "approved" ? 4 : status === "submitted" ? 3 : status === "revision_requested" ? 2 : 1;
}

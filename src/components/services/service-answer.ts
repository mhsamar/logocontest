import type { BriefField, Lang } from "@/lib/services/types";

/** An answer as text, for the wizard's review and the contest page (owner, 2026-10-13). */
export function answerText(f: BriefField, v: string | string[] | undefined, l: (x: Lang) => string): string {
  if (v === undefined) return "";
  const list = Array.isArray(v) ? v : [v];
  if (f.type === "choice" || f.type === "multi_choice") return list.map((x) => l(f.options.find((o) => o.en === x) ?? { en: x, bn: x })).join(", ");
  return list.join(f.type === "colours" ? " " : ", ");
}

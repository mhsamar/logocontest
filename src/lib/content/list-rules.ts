/** Checks an admin's version of a list (A-15) before it is saved. Pure: used by the save action and the tests. */
import { MESSAGES } from "@/lib/i18n/messages";
import { FOOTER_COLUMNS, isHexColour, isSafeLink, LISTS, type ListItem, type ListKey } from "./list-defs";
import { flattenTexts, placeholders, type TextTree } from "./rules";

export type ListProblem = { item: number | null; problem: "tooMany" | "badId" | "required" | "tooLong" | "badLink" | "badColour" | "placeholder" | "fixedSet" | "otherOn" };

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n/g, "\n").trim() : "");

/** The price and time placeholders the built-in Q&A answers use; admin answers may use the same ones. */
export const FAQ_PLACEHOLDERS: string[] = (() => {
  const all = flattenTexts(MESSAGES.en as unknown as TextTree);
  return [...new Set(Object.keys(all).filter((k) => /^home\.faq\.q\d+\.a$/.test(k)).flatMap((k) => placeholders(all[k])))].sort();
})();

/** A cleaned copy of the list, or the first problem found. */
export function checkList(key: ListKey, input: unknown): { ok: true; items: ListItem[] } | { ok: false; error: ListProblem } {
  const def = LISTS[key];
  if (!Array.isArray(input)) return { ok: false, error: { item: null, problem: "required" } };
  if (input.length > def.max) return { ok: false, error: { item: null, problem: "tooMany" } };
  const builtInIds = new Set(def.builtIn.map((b) => b.id));
  const seen = new Set<string>();
  const items: ListItem[] = [];

  for (const [i, raw] of input.entries()) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const idOk = builtInIds.has(id) || (def.canAdd && /^n[a-z0-9]{4,12}$/.test(id));
    if (!idOk || seen.has(id)) return { ok: false, error: { item: i, problem: "badId" } };
    seen.add(id);
    const item: ListItem = { id, on: r.on !== false, en: {}, bn: {} };

    for (const f of def.fields) {
      const en = clean((r.en as Record<string, unknown> | undefined)?.[f.name]);
      const bn = clean((r.bn as Record<string, unknown> | undefined)?.[f.name]);
      if (!en) return { ok: false, error: { item: i, problem: "required" } };
      if (en.length > f.max || bn.length > f.max) return { ok: false, error: { item: i, problem: "tooLong" } };
      if (key === "home_faq") {
        const allowed = f.name === "a" ? FAQ_PLACEHOLDERS : [];
        if ([...placeholders(en), ...placeholders(bn)].some((n) => !allowed.includes(n))) return { ok: false, error: { item: i, problem: "placeholder" } };
      }
      item.en[f.name] = en;
      item.bn[f.name] = bn || en;
    }
    if (def.href) {
      const href = clean(r.href);
      if (!isSafeLink(href)) return { ok: false, error: { item: i, problem: "badLink" } };
      item.href = href;
    }
    if (def.column) {
      const column = FOOTER_COLUMNS.find((c) => c === r.column);
      if (!column) return { ok: false, error: { item: i, problem: "required" } };
      item.column = column;
    }
    if (def.colour) {
      const value = clean(r.value).toLowerCase();
      if (!isHexColour(value)) return { ok: false, error: { item: i, problem: "badColour" } };
      item.value = value;
    }
    items.push(item);
  }

  if (!def.canAdd) {
    if (items.length !== def.builtIn.length) return { ok: false, error: { item: null, problem: "fixedSet" } };
    if (key === "business_types" && !items.find((x) => x.id === "other")?.on) return { ok: false, error: { item: null, problem: "otherOn" } };
  }
  return { ok: true, items };
}

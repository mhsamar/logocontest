/** Site texts (BLUEPRINT §13.1): pure rules shared by the loader, the admin editor and the tests. */

export type TextTree = { [key: string]: string | TextTree };
export type Overrides = Record<string, string>;

export const TEXT_MAX_LENGTH = 5000;

/** Every text in a message tree as "a.b.c" → text. */
export function flattenTexts(tree: TextTree, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else flattenTexts(v, key, out);
  }
  return out;
}

/** A copy of the tree with the admin's texts put in. Keys that are not texts in the tree are ignored. */
export function applyOverrides<T extends TextTree>(tree: T, overrides: Overrides): T {
  const keys = Object.keys(overrides);
  if (!keys.length) return tree;
  const copy = structuredClone(tree) as TextTree;
  for (const key of keys) {
    const parts = key.split(".");
    let node: TextTree | string | undefined = copy;
    for (const part of parts.slice(0, -1)) node = typeof node === "object" ? node[part] : undefined;
    const last = parts[parts.length - 1];
    if (typeof node === "object" && typeof node[last] === "string") node[last] = overrides[key];
  }
  return copy as T;
}

/** The `{name}` placeholders in a text, sorted and without repeats. */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}

export type TextProblem = { kind: "empty" } | { kind: "tooLong" } | { kind: "missing"; names: string[] } | { kind: "extra"; names: string[] };

/** Checks an admin's version of a text against the built-in one: not empty, not too long, same placeholders. */
export function checkText(builtIn: string, value: string): TextProblem | null {
  if (!value.trim()) return { kind: "empty" };
  if (value.length > TEXT_MAX_LENGTH) return { kind: "tooLong" };
  const want = placeholders(builtIn);
  const have = placeholders(value);
  const missing = want.filter((n) => !have.includes(n));
  if (missing.length) return { kind: "missing", names: missing };
  const extra = have.filter((n) => !want.includes(n));
  if (extra.length) return { kind: "extra", names: extra };
  return null;
}

/** Page groups in the admin Texts editor, in order. A key belongs to the first group that matches. */
export const TEXT_GROUPS = [
  { id: "seo", match: (k: string) => /^meta\.|\.meta\./.test(k) },
  { id: "home", sections: ["home"] },
  { id: "how", sections: ["howPage"] },
  { id: "help", sections: ["help", "notFound"] },
  { id: "menu", sections: ["nav", "footer", "brand"] },
  { id: "wizard", sections: ["wizard"] },
  { id: "contests", sections: ["browse", "contest", "entry", "submit", "studio", "manage", "saved"] },
  { id: "clients", sections: ["dashboard", "clientHome", "clientProfile"] },
  { id: "designers", sections: ["designerSignup", "designerDash", "designerHome", "designerProfile", "portfolio", "wallet", "handover", "agreement"] },
  { id: "community", sections: ["leaderboard", "winners", "likes", "gift", "badges", "claims"] },
  { id: "notifications", sections: ["notifications", "lifecycle"] },
  { id: "messages", sections: ["email", "push"] },
  { id: "account", sections: ["auth", "settings"] },
  { id: "admin", sections: ["admin"] },
  { id: "other", match: () => true },
] as const satisfies readonly ({ id: string; sections: readonly string[] } | { id: string; match: (k: string) => boolean })[];

export type TextGroup = (typeof TEXT_GROUPS)[number]["id"];
export const isTextGroup = (v: string): v is TextGroup => TEXT_GROUPS.some((g) => g.id === v);

/** Sections that are never shown in the editor (developer pages). */
const HIDDEN_SECTIONS = new Set(["styleguide"]);

export function groupOf(key: string): TextGroup | null {
  const section = key.split(".")[0];
  if (HIDDEN_SECTIONS.has(section)) return null;
  for (const g of TEXT_GROUPS) {
    if ("match" in g ? g.match(key) : (g.sections as readonly string[]).includes(section)) return g.id;
  }
  return null;
}

export const isEditableKey = (key: string, builtIn: Record<string, string>) => key in builtIn && groupOf(key) !== null;

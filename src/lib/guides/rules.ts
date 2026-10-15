/**
 * Guides (owner, 2026-10-15): articles written in Admin › Guides. The text uses a few simple marks, so a writer needs
 * no HTML and nothing unsafe can reach the page:
 *   ## Heading           ### Smaller heading
 *   - a point            1. a numbered step
 *   **bold**             [link text](https://… or /page)
 *   ![what the picture shows](a picture uploaded in the editor)
 * A blank line starts a new paragraph. Pure: used by the editor, the pages and the tests.
 */

export const GUIDE_CATEGORIES = ["clients", "designers", "everyone"] as const;
export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];
export const isGuideCategory = (v: unknown): v is GuideCategory => (GUIDE_CATEGORIES as readonly unknown[]).includes(v);

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Google prefers full, useful pages: a guide needs at least this many words in English to be published. */
export const MIN_WORDS = 150;
export const LIMITS = { title: 140, summary: 300, body: 60000, slug: 100 } as const;

/** "How to Write a Logo Brief!" → "how-to-write-a-logo-brief". Bangla-only titles give "" (type the address in English). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.slug)
    .replace(/-+$/g, "");
}

/** Words in a guide's text (marks and links count as their words only). */
export function wordCount(body: string): number {
  const plain = body.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*>\-]/g, " ");
  return plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Minutes to read, at 200 words a minute (at least 1). */
export const readingMinutes = (body: string) => Math.max(1, Math.round(wordCount(body) / 200));

export type Inline = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "link"; text: string; href: string };
type Heading = { text: string; id: string };
type ListBlock = { kind: "ul" | "ol"; items: Inline[][] };
export type Block = ({ kind: "h2" } & Heading) | ({ kind: "h3" } & Heading) | { kind: "p"; parts: Inline[] } | ListBlock | { kind: "img"; src: string; alt: string };

/** A link that may be shown: this site's pages (/…) or https addresses. */
export const safeHref = (href: string) => (/^\/(?!\/)[^\s]*$/.test(href) || /^https:\/\/[^\s]+$/.test(href) ? href : null);

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  // A picture inside a sentence shows only its words (pictures go on a line of their own).
  const re = /!\[([^\]]*)\]\([^)\s]+\)|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "text", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "bold", text: m[2] });
    else {
      const href = safeHref(m[4]);
      out.push(href ? { kind: "link", text: m[3], href } : { kind: "text", text: m[3] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

const headingId = (text: string, used: Set<string>) => {
  const base = slugify(text) || "section";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
};

/** The text as blocks. `imageOk` says which picture addresses may be shown (only pictures uploaded here). */
export function parseBody(body: string, imageOk: (src: string) => boolean): Block[] {
  const blocks: Block[] = [];
  const ids = new Set<string>();
  let para: string[] = [];
  // The list being read (an object, so the helpers below can change it).
  const open: { list: ListBlock | null } = { list: null };
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", parts: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (open.list) blocks.push(open.list);
    open.list = null;
  };
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      const text = heading[2].replace(/\*\*/g, "").trim();
      blocks.push({ kind: heading[1].length === 2 ? "h2" : "h3", text, id: headingId(text, ids) } as Block);
    } else if (img) {
      flushPara();
      flushList();
      if (imageOk(img[2])) blocks.push({ kind: "img", src: img[2], alt: img[1].trim() });
    } else if (bullet || numbered) {
      flushPara();
      const kind: "ul" | "ol" = bullet ? "ul" : "ol";
      let list = open.list;
      if (!list || list.kind !== kind) {
        flushList();
        list = open.list = { kind, items: [] };
      }
      list.items.push(parseInline((bullet ?? numbered)![1]));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

/** Picture addresses in the text that are not allowed (anything not uploaded in the editor). */
export const foreignImages = (body: string, imageOk: (src: string) => boolean) => [...body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((src) => !imageOk(src));

export type GuideInput = {
  slug: string;
  category: string;
  titleEn: string;
  titleBn: string;
  summaryEn: string;
  summaryBn: string;
  bodyEn: string;
  bodyBn: string;
  coverPath: string | null;
  status: string;
  inFooter: boolean;
};

export type GuideProblem = "slug" | "title" | "summary" | "body" | "short" | "images" | "cover" | "category" | "status" | "long";

/** What the editor and the save say for each problem. */
export const PROBLEM_TEXT = {
  slug: "admin.guides.errors.slug",
  title: "admin.guides.errors.title",
  summary: "admin.guides.errors.summary",
  body: "admin.guides.errors.body",
  short: "admin.guides.errors.short",
  images: "admin.guides.errors.images",
  cover: "admin.guides.errors.cover",
  category: "admin.guides.errors.generic",
  status: "admin.guides.errors.generic",
  long: "admin.guides.errors.long",
} as const satisfies Record<GuideProblem, string>;

/** What is wrong with a guide before saving, if anything. A draft can be unfinished; a published guide must be complete. */
export function guideProblems(g: GuideInput, imageOk: (src: string) => boolean): GuideProblem[] {
  const out: GuideProblem[] = [];
  if (!SLUG.test(g.slug) || g.slug.length > LIMITS.slug) out.push("slug");
  if (!isGuideCategory(g.category)) out.push("category");
  if (g.status !== "draft" && g.status !== "published") out.push("status");
  if (g.coverPath !== null && !/^guides\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(g.coverPath)) out.push("cover");
  if ([g.titleEn, g.titleBn].some((x) => x.length > LIMITS.title) || [g.summaryEn, g.summaryBn].some((x) => x.length > LIMITS.summary) || [g.bodyEn, g.bodyBn].some((x) => x.length > LIMITS.body)) out.push("long");
  if (foreignImages(`${g.bodyEn}\n${g.bodyBn}`, imageOk).length) out.push("images");
  if (g.titleEn.trim().length < 5) out.push("title");
  if (g.status === "published") {
    if (g.summaryEn.trim().length < 50) out.push("summary");
    if (!g.bodyEn.trim()) out.push("body");
    else if (wordCount(g.bodyEn) < MIN_WORDS) out.push("short");
  }
  return out;
}

/** Pictures in a guide: only ones uploaded in the editor (the site bucket's guides/ folder). */
export const GUIDE_PICTURE_PATH = /^guides\/[0-9a-f-]{36}\.(png|jpg|webp)$/;
export function guideImageOk(supabaseUrl: string | undefined): (src: string) => boolean {
  const base = `${(supabaseUrl ?? "").replace(/\/$/, "")}/storage/v1/object/public/site/`;
  return (src) => Boolean(supabaseUrl) && src.startsWith(base) && GUIDE_PICTURE_PATH.test(src.slice(base.length));
}

/** The stored paths of the pictures a guide's text uses. */
export const bodyPicturePaths = (body: string, supabaseUrl: string | undefined) => {
  const ok = guideImageOk(supabaseUrl);
  const base = `${(supabaseUrl ?? "").replace(/\/$/, "")}/storage/v1/object/public/site/`;
  return [...body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter(ok).map((src) => src.slice(base.length));
};

/** The Bangla version is complete: a title, a summary and as many words as an English guide needs. */
export const bnReady = (g: { titleBn: string; summaryBn: string; bodyBn: string }) => g.titleBn.trim().length >= 3 && g.summaryBn.trim().length >= 20 && wordCount(g.bodyBn) >= MIN_WORDS;

/**
 * A guide in one language. Bangla readers get the whole Bangla version once it is complete, and the whole English one
 * until then (never half of each: a half-written Bangla text must not hide the English guide).
 */
export function guideText(g: { title_en: string; title_bn: string; summary_en: string; summary_bn: string; body_en?: string; body_bn?: string; bn_ready: boolean }, locale: "en" | "bn") {
  const lang: "en" | "bn" = locale === "bn" && g.bn_ready ? "bn" : "en";
  const pick = (en: string, b: string) => ({ text: lang === "bn" ? b : en, lang });
  return { lang, title: pick(g.title_en, g.title_bn), summary: pick(g.summary_en, g.summary_bn), body: pick(g.body_en ?? "", g.body_bn ?? "") };
}

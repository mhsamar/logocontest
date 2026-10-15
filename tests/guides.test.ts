import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bnReady, bodyPicturePaths, foreignImages, GUIDE_CATEGORIES, guideImageOk, guideProblems, guideText, MIN_WORDS, parseBody, parseInline, PROBLEM_TEXT, readingMinutes, safeHref, slugify, wordCount, type GuideInput } from "@/lib/guides/rules";
import { MESSAGES } from "@/lib/i18n/messages";

const BASE = "https://abc.supabase.co";
const ok = guideImageOk(BASE);
const pic = `${BASE}/storage/v1/object/public/site/guides/0f8fad5b-d9cb-469f-a165-70867728950e.webp`;
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const text = (locale: "en" | "bn", key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), MESSAGES[locale]);

const guide = (over: Partial<GuideInput> = {}): GuideInput => ({
  slug: "how-to-write-a-logo-brief",
  category: "clients",
  titleEn: "How to write a logo brief",
  titleBn: "",
  summaryEn: "What to put in your brief so designers understand your business and send better logos.",
  summaryBn: "",
  bodyEn: words(MIN_WORDS),
  bodyBn: "",
  coverPath: null,
  status: "published",
  inFooter: false,
  ...over,
});

describe("Guides (owner, 2026-10-15)", () => {
  it("addresses are made from the English title", () => {
    expect(slugify("How to Write a Logo Brief!")).toBe("how-to-write-a-logo-brief");
    expect(slugify("  Café & Brand: 5 tips  ")).toBe("cafe-and-brand-5-tips");
    expect(slugify("লোগো ব্রিফ")).toBe("");
    expect(slugify("a".repeat(120))).toHaveLength(100);
  });

  it("counts words, Bangla too, and the minutes to read", () => {
    expect(wordCount("## Heading\n\n- one **two**\n[three four](/start) ![alt words](x)")).toBe(5);
    expect(wordCount("আমার লোগো দরকার")).toBe(3);
    expect(readingMinutes(words(10))).toBe(1);
    expect(readingMinutes(words(1000))).toBe(5);
  });

  it("links: only this site's pages and https addresses", () => {
    expect(safeHref("/start")).toBe("/start");
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    for (const bad of ["javascript:alert(1)", "//evil.com", "http://example.com", "data:text/html,x", "mailto:a@b.c"]) expect(safeHref(bad), bad).toBeNull();
    expect(parseInline("Read **this** and [start](/start), not [that](javascript:alert(1))")).toEqual([
      { kind: "text", text: "Read " },
      { kind: "bold", text: "this" },
      { kind: "text", text: " and " },
      { kind: "link", text: "start", href: "/start" },
      { kind: "text", text: ", not " },
      { kind: "text", text: "that" },
      { kind: "text", text: ")" },
    ]);
    expect(parseInline("See ![the sketch](https://x.com/a.png) here")).toEqual([
      { kind: "text", text: "See " },
      { kind: "text", text: "the sketch" },
      { kind: "text", text: " here" },
    ]);
  });

  it("the text becomes headings, paragraphs, lists and pictures; HTML stays plain text", () => {
    const blocks = parseBody(`## Why a brief\nA good brief\nsaves time.\n\n- one\n- two\n1. first\n2. second\n\n## Why a brief\n![a sketch](${pic})\n![other](https://evil.com/x.png)\n<script>alert(1)</script>`, ok);
    expect(blocks).toEqual([
      { kind: "h2", text: "Why a brief", id: "why-a-brief" },
      { kind: "p", parts: [{ kind: "text", text: "A good brief saves time." }] },
      { kind: "ul", items: [[{ kind: "text", text: "one" }], [{ kind: "text", text: "two" }]] },
      { kind: "ol", items: [[{ kind: "text", text: "first" }], [{ kind: "text", text: "second" }]] },
      { kind: "h2", text: "Why a brief", id: "why-a-brief-2" },
      { kind: "img", src: pic, alt: "a sketch" },
      { kind: "p", parts: [{ kind: "text", text: "<script>alert(1)</script>" }] },
    ]);
  });

  it("pictures: only ones uploaded in the editor", () => {
    expect(ok(pic)).toBe(true);
    expect(ok(pic.replace("abc.supabase.co", "evil.com"))).toBe(false);
    expect(ok(`${BASE}/storage/v1/object/public/site/hero/0f8fad5b-d9cb-469f-a165-70867728950e.webp`)).toBe(false);
    expect(ok(`${BASE}/storage/v1/object/public/site/guides/../brand/x.png`)).toBe(false);
    expect(guideImageOk(undefined)(pic)).toBe(false);
    expect(foreignImages(`![a](${pic})\n![b](https://x.com/y.png)`, ok)).toEqual(["https://x.com/y.png"]);
    expect(bodyPicturePaths(`![a](${pic}) ![b](https://x.com/y.png)`, BASE)).toEqual(["guides/0f8fad5b-d9cb-469f-a165-70867728950e.webp"]);
  });

  it("a draft can be unfinished; a published guide must be complete", () => {
    expect(guideProblems(guide(), ok)).toEqual([]);
    expect(guideProblems(guide({ status: "draft", summaryEn: "", bodyEn: "" }), ok)).toEqual([]);
    expect(guideProblems(guide({ summaryEn: "Short." }), ok)).toEqual(["summary"]);
    expect(guideProblems(guide({ bodyEn: words(MIN_WORDS - 1) }), ok)).toEqual(["short"]);
    expect(guideProblems(guide({ bodyEn: "" }), ok)).toEqual(["body"]);
    expect(guideProblems(guide({ status: "draft", titleEn: "Hi" }), ok)).toEqual(["title"]);
    expect(guideProblems(guide({ slug: "Bad Slug" }), ok)).toEqual(["slug"]);
    expect(guideProblems(guide({ slug: "-x" }), ok)).toEqual(["slug"]);
    expect(guideProblems(guide({ category: "all" }), ok)).toEqual(["category"]);
    expect(guideProblems(guide({ status: "live" }), ok)).toEqual(["status"]);
    expect(guideProblems(guide({ coverPath: "brand/x.png" }), ok)).toEqual(["cover"]);
    expect(guideProblems(guide({ coverPath: "guides/0f8fad5b-d9cb-469f-a165-70867728950e.jpg" }), ok)).toEqual([]);
    expect(guideProblems(guide({ bodyBn: "![x](https://x.com/y.png)" }), ok)).toEqual(["images"]);
    expect(guideProblems(guide({ titleEn: "x".repeat(141) }), ok)).toEqual(["long"]);
  });

  it("Bangla readers get the whole Bangla version once it is complete, the whole English one until then", () => {
    const g = { title_en: "Brief", title_bn: "ব্রিফ", summary_en: "S", summary_bn: "স", body_en: "B", body_bn: "ব" };
    expect(guideText({ ...g, bn_ready: true }, "bn")).toEqual({ lang: "bn", title: { text: "ব্রিফ", lang: "bn" }, summary: { text: "স", lang: "bn" }, body: { text: "ব", lang: "bn" } });
    expect(guideText({ ...g, bn_ready: false }, "bn")).toEqual({ lang: "en", title: { text: "Brief", lang: "en" }, summary: { text: "S", lang: "en" }, body: { text: "B", lang: "en" } });
    expect(guideText({ ...g, bn_ready: true }, "en").title).toEqual({ text: "Brief", lang: "en" });
    const bnWords = Array.from({ length: MIN_WORDS }, () => "শব্দ").join(" ");
    expect(bnReady({ titleBn: "লোগো ব্রিফ", summaryBn: "ডিজাইনাররা যেন বোঝে এমন ব্রিফ লেখার নিয়ম।", bodyBn: bnWords })).toBe(true);
    expect(bnReady({ titleBn: "লোগো ব্রিফ", summaryBn: "ডিজাইনাররা যেন বোঝে এমন ব্রিফ লেখার নিয়ম।", bodyBn: "## শুধু একটি হেডিং" })).toBe(false);
    expect(bnReady({ titleBn: "", summaryBn: "ডিজাইনাররা যেন বোঝে এমন ব্রিফ লেখার নিয়ম।", bodyBn: bnWords })).toBe(false);
  });

  it("every text the guides use is there in English and Bangla", () => {
    for (const locale of ["en", "bn"] as const) {
      for (const c of GUIDE_CATEGORIES) expect(typeof text(locale, `guides.categories.${c}`), `${locale} ${c}`).toBe("string");
      for (const key of Object.values(PROBLEM_TEXT)) expect(typeof text(locale, key), `${locale} ${key}`).toBe("string");
      for (const a of ["guide_create", "guide_update", "guide_delete"]) expect(typeof text(locale, `admin.audit.actions.${a}`), `${locale} ${a}`).toBe("string");
      for (const k of ["footer.guides", "footer.allGuides", "admin.nav.guides"]) expect(typeof text(locale, k), `${locale} ${k}`).toBe("string");
    }
  });

  it("the database keeps the same rules (migration 0060)", () => {
    const sql = readFileSync("supabase/migrations/0060_guides.sql", "utf8");
    expect(sql).toContain("alter table public.guides enable row level security");
    expect(sql).toContain("^[a-z0-9]+(-[a-z0-9]+)*$");
    expect(sql).toContain("char_length(summary_en) <= 300");
    expect(sql).toContain("char_length(body_en) <= 60000");
    expect(sql).toContain("'clients', 'designers', 'everyone'");
    expect(sql).toContain("^guides/[0-9a-f-]{36}\\.(png|jpg|webp)$");
    expect(sql).toContain("bn_ready      boolean not null default false");
  });
});

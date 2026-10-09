import { describe, expect, it } from "vitest";
import { applyOverrides, checkText, flattenTexts, groupOf, isEditableKey, placeholders, type TextTree } from "@/lib/content/rules";
import { isSafeLink, LISTS } from "@/lib/content/list-defs";
import { checkList, FAQ_PLACEHOLDERS } from "@/lib/content/list-rules";
import { noticeId } from "@/lib/content/notice-rules";
import { MESSAGES } from "@/lib/i18n/messages";
import { parseSetting } from "@/lib/settings/registry";

const tree: TextTree = { home: { title: "Hi {name}", faq: { q1: { q: "Q?", a: "A {fee}%" } } }, styleguide: { x: "dev" } };

describe("site texts (BLUEPRINT §13.1)", () => {
  it("flattens a message tree to dotted keys", () => {
    expect(flattenTexts(tree)).toEqual({ "home.title": "Hi {name}", "home.faq.q1.q": "Q?", "home.faq.q1.a": "A {fee}%", "styleguide.x": "dev" });
  });

  it("puts admin texts in without touching the original, and ignores unknown or non-text keys", () => {
    const out = applyOverrides(tree, { "home.title": "Hello {name}", "home.faq": "nope", "home.missing": "x" });
    expect((out.home as TextTree).title).toBe("Hello {name}");
    expect(((out.home as TextTree).faq as TextTree).q1).toEqual({ q: "Q?", a: "A {fee}%" });
    expect((tree.home as TextTree).title).toBe("Hi {name}");
    expect(applyOverrides(tree, {})).toBe(tree);
  });

  it("lists placeholders once, sorted", () => {
    expect(placeholders("{b} and {a} and {b}")).toEqual(["a", "b"]);
    expect(placeholders("none")).toEqual([]);
  });

  it("refuses empty, too long, missing or extra placeholders", () => {
    expect(checkText("© {year} site", "© {year} new")).toBeNull();
    expect(checkText("x", "   ")).toEqual({ kind: "empty" });
    expect(checkText("x", "a".repeat(5001))).toEqual({ kind: "tooLong" });
    expect(checkText("© {year} site", "© site")).toEqual({ kind: "missing", names: ["year"] });
    expect(checkText("Hi", "Hi {name}")).toEqual({ kind: "extra", names: ["name"] });
  });

  it("groups keys by page, hides developer pages, and every real text has a group", () => {
    expect(groupOf("home.title")).toBe("home");
    expect(groupOf("meta.title")).toBe("seo");
    expect(groupOf("wizard.meta.title")).toBe("seo");
    expect(groupOf("footer.rights")).toBe("menu");
    expect(groupOf("styleguide.title")).toBeNull();
    const en = flattenTexts(MESSAGES.en as unknown as TextTree);
    expect(isEditableKey("home.title", en)).toBe(true);
    expect(isEditableKey("home.nope", en)).toBe(false);
    for (const key of Object.keys(en)) if (!key.startsWith("styleguide.")) expect(groupOf(key)).not.toBeNull();
  });

  it("built-in Bangla texts keep the English placeholders, so admin edits are checked fairly", () => {
    const en = flattenTexts(MESSAGES.en as unknown as TextTree);
    const bn = flattenTexts(MESSAGES.bn as unknown as TextTree);
    const off = Object.keys(en).filter((k) => bn[k] !== undefined && placeholders(en[k]).join() !== placeholders(bn[k]).join());
    expect(off).toEqual([]);
  });
});

describe("notice bar and contact settings", () => {
  it("gives each notice version its own id", () => {
    expect(noticeId("a", "b", "/x")).toBe(noticeId("a", "b", "/x"));
    expect(noticeId("a", "b", "/x")).not.toBe(noticeId("a", "b", "/y"));
  });

  it("accepts only site pages or https links for the notice link", () => {
    expect(parseSetting("notice.link", "/contests")).toBe("/contests");
    expect(parseSetting("notice.link", "https://facebook.com/x")).toBe("https://facebook.com/x");
    expect(parseSetting("notice.link", "//evil.com")).toBe("");
    expect(parseSetting("notice.link", "javascript:alert(1)")).toBe("");
  });

  it("checks the support phone and email", () => {
    expect(parseSetting("contact.phone", "01812345678")).toBe("01812345678");
    expect(parseSetting("contact.phone", "12345")).toBe("01712028511");
    expect(parseSetting("contact.email", "")).toBe("");
    expect(parseSetting("contact.email", "not-an-email")).toBe("");
    expect(parseSetting("notice.tone", "neon")).toBe("info");
  });
});

describe("editable lists (A-15)", () => {
  const faqItem = (over: Record<string, unknown> = {}) => ({ id: "q1", on: true, en: { q: "Q?", a: "Fee {fee}%" }, bn: { q: "", a: "" }, ...over });

  it("cleans a Q&A list, filling empty Bangla from English", () => {
    const res = checkList("home_faq", [faqItem(), { id: "nabc123", on: false, en: { q: " New? ", a: "Yes." }, bn: { q: "নতুন?", a: "হ্যাঁ।" } }]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items[0].bn).toEqual({ q: "Q?", a: "Fee {fee}%" });
    expect(res.items[1]).toMatchObject({ id: "nabc123", on: false, en: { q: "New?" } });
  });

  it("refuses unknown placeholders, empty English, bad or repeated ids", () => {
    expect(FAQ_PLACEHOLDERS).toContain("fee");
    expect(checkList("home_faq", [faqItem({ en: { q: "Q?", a: "{secret}" } })])).toMatchObject({ ok: false, error: { problem: "placeholder" } });
    expect(checkList("home_faq", [faqItem({ en: { q: "{fee}?", a: "A" } })])).toMatchObject({ ok: false, error: { problem: "placeholder" } });
    expect(checkList("home_faq", [faqItem({ en: { q: " ", a: "A" } })])).toMatchObject({ ok: false, error: { problem: "required" } });
    expect(checkList("home_faq", [faqItem({ id: "evil" })])).toMatchObject({ ok: false, error: { problem: "badId" } });
    expect(checkList("home_faq", [faqItem(), faqItem()])).toMatchObject({ ok: false, error: { problem: "badId" } });
  });

  it("only allows site pages or https links in menus", () => {
    const item = (href: string) => ({ id: "browse", on: true, en: { label: "Browse" }, bn: {}, href });
    expect(checkList("header_menu", [item("/contests")]).ok).toBe(true);
    expect(checkList("header_menu", [item("https://facebook.com/x")]).ok).toBe(true);
    for (const bad of ["javascript:alert(1)", "//evil.com", "http://x.com", ""]) expect(checkList("header_menu", [item(bad)])).toMatchObject({ ok: false, error: { problem: "badLink" } });
    expect(isSafeLink("/a b")).toBe(false);
  });

  it("keeps the header menu to 6 and footer links in a real column", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `nitem${i}`, on: true, en: { label: "x" }, bn: {}, href: "/" }));
    expect(checkList("header_menu", many)).toMatchObject({ ok: false, error: { problem: "tooMany" } });
    expect(checkList("footer_links", [{ id: "c-start", on: true, en: { label: "x" }, bn: {}, href: "/", column: "secret" }])).toMatchObject({ ok: false, error: { problem: "required" } });
  });

  it("business types can only be hidden or moved, and Other stays on", () => {
    const all = LISTS.business_types.builtIn.map((b) => ({ id: b.id, on: true, en: {}, bn: {} }));
    expect(checkList("business_types", [...all].reverse()).ok).toBe(true);
    expect(checkList("business_types", all.slice(1))).toMatchObject({ ok: false, error: { problem: "fixedSet" } });
    expect(checkList("business_types", all.map((b) => (b.id === "other" ? { ...b, on: false } : b)))).toMatchObject({ ok: false, error: { problem: "otherOn" } });
    expect(checkList("business_types", [...all.slice(1), { id: "nnewtype", on: true, en: {}, bn: {} }])).toMatchObject({ ok: false, error: { problem: "badId" } });
  });

  it("colours must be #rrggbb and are stored lower case", () => {
    const res = checkList("colours", [{ id: "c1", on: true, en: {}, bn: {}, value: "#AABBCC" }]);
    expect(res.ok && res.items[0].value).toBe("#aabbcc");
    expect(checkList("colours", [{ id: "c1", on: true, en: {}, bn: {}, value: "red" }])).toMatchObject({ ok: false, error: { problem: "badColour" } });
  });
});

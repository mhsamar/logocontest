import { describe, expect, it } from "vitest";
import {
  briefLines,
  categoryType,
  cleanBriefText,
  clipWords,
  countDone,
  countWords,
  DEFAULT_CATEGORIES,
  DEFAULT_TEMPLATES,
  fillTemplate,
  firstMissing,
  GENERAL,
  HEADINGS,
  insertHeading,
  linkParts,
  parseCategories,
  parseTemplates,
  sectionsDone,
} from "@/lib/brief-v3/rules";
import { timeLabel, whenLabel } from "@/components/brief-v3/when";

const t = (key: string, p?: Record<string, string | number>) => `${key}${p ? JSON.stringify(p) : ""}`;

describe("new brief rules (owner, 2026-11-08)", () => {
  it("counts words split on spaces and line breaks, Bangla too", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  ক্যাফে  কফি\nআর চা ")).toBe(4);
  });

  it("cuts after N words keeping what was typed", () => {
    expect(clipWords("এক দুই\nতিন চার", 3)).toBe("এক দুই\nতিন");
    expect(clipWords("এক দুই", 5)).toBe("এক দুই");
  });

  it("marks a heading done only with text after the colon (a lone … is not text)", () => {
    const text = "ব্র্যান্ড পরিচিতি: ছোট ক্যাফে\nআইকনের ধরন:\nরঙের দিক: …\nটাইপোগ্রাফি : গোল ফন্ট";
    const done = sectionsDone(text);
    expect(done[0]).toBe(true);
    expect(done[1]).toBe(false);
    expect(done[3]).toBe(true);
    expect(done[4]).toBe(false);
    expect(countDone(text)).toBe(2);
    expect(firstMissing(text)).toBe("আইকনের ধরন");
  });

  it("every default template has all 9 headings and blanks to fill", () => {
    for (const [id, tpl] of Object.entries(DEFAULT_TEMPLATES)) {
      const text = fillTemplate(DEFAULT_TEMPLATES, id === GENERAL ? "other" : id, { logoName: "Green Leaf", other: "হাতে বানানো গয়না" });
      for (const h of HEADINGS) expect(text, `${id}: ${h}`).toContain(`${h}:`);
      expect(text).not.toContain("{logo_name}");
      expect(text).not.toContain("{business}");
      expect(tpl.split("\n")).toHaveLength(9);
    }
  });

  it("Other uses the general template with the client's words under the brand", () => {
    const text = fillTemplate(DEFAULT_TEMPLATES, "other", { logoName: "Mati", other: "মাটির গয়না" });
    expect(text.split("\n")[0]).toBe("ব্র্যান্ড পরিচিতি: Mati: মাটির গয়না");
  });

  it("a chip adds its heading on a new line with the caret after it", () => {
    expect(insertHeading("", "রঙের দিক")).toEqual({ text: "রঙের দিক: ", caret: 10 });
    const r = insertHeading("আগের লেখা  ", "টাইপোগ্রাফি");
    expect(r.text).toBe("আগের লেখা\nটাইপোগ্রাফি: ");
    expect(r.caret).toBe(r.text.length);
  });

  it("keeps no HTML or odd characters, at most one empty line", () => {
    expect(cleanBriefText("<script>x()</script>হাই<b>!</b>\r\n\r\n\r\n\r\nশেষ  \u0007")).toBe("x()হাই!\n\nশেষ");
  });

  it("splits headings out for display and finds links", () => {
    expect(briefLines("রঙের দিক: সবুজ\nনিজের লেখা")).toEqual([
      { heading: "রঙের দিক", text: "সবুজ", raw: "রঙের দিক: সবুজ" },
      { heading: null, text: "নিজের লেখা", raw: "নিজের লেখা" },
    ]);
    expect(linkParts("দেখুন https://fb.com/x।")).toEqual([{ text: "দেখুন " }, { text: "https://fb.com/x", href: "https://fb.com/x" }, { text: "।" }]);
  });

  it("reads admin categories safely and maps them to older types", () => {
    expect(parseCategories(null)).toBe(DEFAULT_CATEGORIES);
    const list = parseCategories([{ id: "cafe", bn: "ক্যাফে", type: "food" }, { id: "cafe", bn: "আবার" }, { id: "other", bn: "x" }, { id: "Bad Id", bn: "x" }, { id: "x1", bn: "নতুন", type: "nope", on: false }]);
    expect(list.map((c) => c.id)).toEqual(["cafe", "x1"]);
    expect(list[1]).toMatchObject({ type: "other", on: false, en: "নতুন" });
    expect(categoryType("cafe", list)).toBe("food");
    expect(categoryType("other", list)).toBe("other");
    expect(parseTemplates({ cafe: "  " }).cafe).toBe(DEFAULT_TEMPLATES.cafe);
  });
});

describe("update times in Bangladesh time", () => {
  const now = new Date("2026-11-08T06:00:00Z"); // 12:00 in Dhaka
  it("says today, yesterday and the part of the day", () => {
    expect(timeLabel(new Date("2026-11-07T15:10:00Z"), "bn")).toBe("রাত ৯:১০");
    expect(whenLabel("2026-11-07T15:10:00Z", t as never, "bn", now)).toBe('briefV3.when.yesterdayAt{"time":"রাত ৯:১০"}');
    expect(whenLabel("2026-11-08T04:05:00Z", t as never, "en", now)).toBe('briefV3.when.todayAt{"time":"10:05 am"}');
  });
});

import { describe, expect, it } from "vitest";
import { cleanAnswers, DEFAULT_SERVICES, isLogo, parseService, sizeText } from "@/lib/services/types";

const thumb = DEFAULT_SERVICES.find((s) => s.slug === "youtube_thumbnail")!;
const post = DEFAULT_SERVICES.find((s) => s.slug === "social_post")!;

describe("contest services (owner, 2026-10-13)", () => {
  it("starts with only Logo on, and eight planned services off", () => {
    expect(DEFAULT_SERVICES.filter((s) => s.on).map((s) => s.slug)).toEqual(["logo"]);
    expect(DEFAULT_SERVICES.map((s) => s.slug)).toEqual(["logo", "youtube_thumbnail", "social_post", "facebook_cover", "youtube_banner", "x_header", "business_card", "flyer", "tshirt"]);
    expect(isLogo(undefined)).toBe(true);
    expect(sizeText(thumb)).toBe("1280 × 720 px");
  });

  it("checks the client's answers against the service's questions", () => {
    expect(cleanAnswers(thumb, { video_title: "Beef curry", audience: "Cooks", extra: "dropped" })).toEqual({ answers: { video_title: "Beef curry", audience: "Cooks" }, errors: {} });
    expect(cleanAnswers(thumb, { video_title: "" }).errors).toEqual({ video_title: "required", audience: "required" });
    expect(cleanAnswers(thumb, { video_title: "a", audience: "b", references: "not a link" }).errors).toEqual({ references: "invalid" });
    expect(cleanAnswers(post, { platform: ["Facebook", "Nope"], post_text: "Sale" }).errors).toEqual({ platform: "invalid" });
    expect(cleanAnswers(post, { platform: ["Instagram"], post_text: "Sale", colours: ["#FF0000"] }).answers.colours).toEqual(["#ff0000"]);
  });

  it("reads an admin's new service and refuses broken ones", () => {
    const base = { slug: "instagram_story", name: { en: "Instagram story", bn: "ইনস্টাগ্রাম স্টোরি" }, entryTypes: ["png"], finalTypes: ["png"], minPrize: 1000, defaultPrize: 500, fields: [{ key: "text", type: "text", label: { en: "Text", bn: "লেখা" }, required: true }] };
    const ok = parseService(base, null);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.service.on).toBe(false);
      expect(ok.service.defaultPrize).toBe(1000);
      expect(ok.service.winners).toBe(1);
    }
    expect(parseService({ ...base, slug: "Bad Slug" }, null)).toEqual({ ok: false, error: "slug" });
    expect(parseService({ ...base, entryTypes: [] }, null)).toEqual({ ok: false, error: "entryTypes" });
    expect(parseService({ ...base, fields: [{ key: "x", type: "choice", label: { en: "X", bn: "X" }, options: [{ en: "A", bn: "A" }] }] }, null)).toEqual({ ok: false, error: "fieldOptions" });
    expect(parseService({ ...base, fields: [{ key: "title", type: "text", label: { en: "X", bn: "X" } }] }, null)).toEqual({ ok: false, error: "fieldKey" });
  });

  it("never lets an admin give Logo brief questions", () => {
    const logo = DEFAULT_SERVICES[0];
    const r = parseService({ ...logo, fields: [{ key: "x", type: "text", label: { en: "X", bn: "X" } }] }, logo);
    expect(r.ok && r.service.fields).toEqual([]);
  });
});

describe("ready answers for the onboarding boxes (owner, 2026-10-13)", () => {
  it("keeps a service question's suggestions, at most 8, only for written answers", () => {
    const base = { slug: "promo_video_cover", name: { en: "Cover", bn: "কভার" }, entryTypes: ["png"], finalTypes: ["png"], minPrize: 1000, defaultPrize: 1000 };
    const many = Array.from({ length: 10 }, (_, i) => ({ en: `Idea ${i}`, bn: `আইডিয়া ${i}` }));
    const r = parseService({ ...base, fields: [{ key: "line", type: "text", label: { en: "Line", bn: "লাইন" }, suggestions: many }, { key: "pick", type: "choice", label: { en: "Pick", bn: "বাছুন" }, options: [{ en: "A", bn: "A" }, { en: "B", bn: "B" }], suggestions: many }] }, null);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.service.fields[0].suggestions).toHaveLength(8);
      expect(r.service.fields[1].suggestions).toEqual([]);
    }
  });

  it("gives the planned services ready answers on their written questions", () => {
    const thumbText = thumb.fields.find((f) => f.key === "thumb_text")!;
    expect(thumbText.suggestions?.length).toBeGreaterThan(0);
    expect(thumbText.suggestions!.every((s) => s.en && s.bn)).toBe(true);
  });
});

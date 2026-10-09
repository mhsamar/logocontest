import { describe, expect, it } from "vitest";
import bn from "@/lib/i18n/messages/bn";
import en from "@/lib/i18n/messages/en";
import { CATEGORIES, CATEGORY_OF, CATEGORY_STYLE } from "@/lib/notifications/categories";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";

describe("notification categories (owner, 2026-10-09)", () => {
  it("every type has a category, a style and a text in English and Bangla", () => {
    for (const type of NOTIFICATION_TYPES) {
      const cat = CATEGORY_OF[type];
      expect(CATEGORIES, type).toContain(cat);
      expect(CATEGORY_STYLE[cat].tile, type).toBeTruthy();
      expect(en.notifications.types[type as keyof typeof en.notifications.types], `en ${type}`).toBeTruthy();
      expect(bn.notifications.types[type as keyof typeof bn.notifications.types], `bn ${type}`).toBeTruthy();
    }
  });

  it("every category has a label and its own colour", () => {
    for (const c of CATEGORIES) {
      expect(en.notifications.categories[c]).toBeTruthy();
      expect(bn.notifications.categories[c]).toBeTruthy();
    }
    const bars = CATEGORIES.map((c) => CATEGORY_STYLE[c].bar);
    expect(new Set(bars).size).toBe(bars.length);
  });

  it("the owner's list maps to the right kinds", () => {
    expect(CATEGORY_OF.brief_updated).toBe("brief");
    expect(CATEGORY_OF.entry_rated).toBe("rating");
    expect(CATEGORY_OF.entry_comment_client).toBe("feedback");
    expect(CATEGORY_OF.contest_new).toBe("newContest");
    expect(CATEGORY_OF.contest_ending).toBe("ending");
    expect(CATEGORY_OF.winner_picked).toBe("winner");
    expect(CATEGORY_OF.files_due).toBe("files");
    expect(CATEGORY_OF.handover_approved).toBe("approved");
    expect(CATEGORY_OF.prize_released).toBe("money");
    expect(CATEGORY_OF.design_liked).toBe("like");
    expect(CATEGORY_OF.entry_comment_other).toBe("comment");
    expect(CATEGORY_OF.entry_new).toBe("newDesign");
    expect(CATEGORY_OF.entry_comment_designer).toBe("reply");
    expect(CATEGORY_OF.design_liked_client).toBe("like");
  });
});

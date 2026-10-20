import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/messages/en";
import bn from "@/lib/i18n/messages/bn";
import { monthlyCardHtml } from "@/lib/rewards/card-html";

/** Owner, 2026-10-20: the client's smartphone prize became a gift box everywhere ("smartphone" stays only as the code's name). */
const texts = (o: unknown): string[] => (typeof o === "string" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(texts) : []);

describe("client gift box (owner, 2026-10-20)", () => {
  it("no English or Bangla text promises a smartphone any more", () => {
    expect(texts(en).filter((s) => /smart ?phone/i.test(s))).toEqual([]);
    expect(texts(bn).filter((s) => /স্মার্ট ?ফোন/.test(s))).toEqual([]);
  });

  it("the client's monthly card shows a gold gift box, not a phone", () => {
    const base = { size: "square", origin: "https://logocontest.bd", lang: "en", month: "October 2026", kicker: "Congratulations", name: "Rahim", line: "Won", footer: "Client of the month", photoUrl: null } as const;
    const client = monthlyCardHtml({ ...base, kind: "smartphone" });
    const designer = monthlyCardHtml({ ...base, kind: "gift_box" });
    expect(client).toContain('class="gb gold"');
    expect(client).not.toContain('class="ph"');
    expect(designer).toContain('class="gb"');
  });
});

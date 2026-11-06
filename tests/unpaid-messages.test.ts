import { describe, expect, it } from "vitest";
import { fillMessage, MESSAGE_KEYS, needsLink, pickMessage } from "@/lib/admin/unpaid-messages";

/** Ready follow-up messages for unpaid contests (owner, 2026-11-06). */
describe("ready messages", () => {
  const now = new Date("2026-11-06T10:00:00Z");
  const hours = (h: number) => new Date(now.getTime() - h * 3_600_000);

  it("picks by where they stopped and how often they were contacted", () => {
    expect(pickMessage({ atPayment: false, contacts: 0, startedAt: hours(2) }, now)).toBe("a1");
    expect(pickMessage({ atPayment: false, contacts: 1, startedAt: hours(26) }, now)).toBe("a2");
    expect(pickMessage({ atPayment: true, contacts: 0, startedAt: hours(2) }, now)).toBe("b1");
    expect(pickMessage({ atPayment: true, contacts: 2, startedAt: hours(30) }, now)).toBe("b2");
    expect(pickMessage({ atPayment: true, contacts: 2, startedAt: hours(80) }, now)).toBe("last");
    // Never contacted yet: still the first message, even after 3 days.
    expect(pickMessage({ atPayment: false, contacts: 0, startedAt: hours(100) }, now)).toBe("a1");
  });

  it("fills in the name, the logo, the salutation, the link and the bKash number", () => {
    const b1 = fillMessage("b1", { name: "রহিম", logo: "Rahim Tea", salute: "bhai", bkash: "01712028511" });
    expect(b1).toContain("আসসালামু আলাইকুম রহিম ভাই 🙂");
    expect(b1).toContain("“Rahim Tea”-এর লোগো কনটেস্টটা");
    expect(b1).toContain("বিকাশ নম্বর: 01712028511");
    const a2 = fillMessage("a2", { name: "Karim", logo: "KC", salute: "both", link: "https://logocontest.bd/r/abc" });
    expect(a2).toContain("Karim ভাই/আপু");
    expect(a2).toContain("লিংক: https://logocontest.bd/r/abc");
    expect(needsLink("a2")).toBe(true);
    expect(needsLink("b1")).toBe(false);
  });

  it("no name: no stray spaces", () => {
    expect(fillMessage("a1", { name: null, logo: "X", salute: "apu" })).toMatch(/^আসসালামু আলাইকুম আপু 🙂/);
    for (const k of MESSAGE_KEYS) expect(fillMessage(k, { name: "A", logo: "B", salute: "both", link: "L", bkash: "N" })).not.toMatch(/\{\w+\}/);
  });
});

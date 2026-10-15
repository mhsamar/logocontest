import { describe, expect, it } from "vitest";
import { cleanReply, conversationText, dhakaMidnight, isThreadMode, readAnswer, systemPrompt, wantsHuman } from "@/lib/support/ai-rules";

describe("AI support assistant (owner, 2026-10-15)", () => {
  it("asking for a person always goes to the team, in English, Bangla and Banglish", () => {
    for (const s of ["Can I talk to a person?", "I want a human", "please connect me to an agent", "customer care", "admin er sathe kotha bolte chai", "manush er sathe kotha bolbo", "আমি একজন মানুষের সাথে কথা বলতে চাই", "অ্যাডমিনের সাথে কথা"]) {
      expect(wantsHuman(s), s).toBe(true);
    }
    for (const s of ["How much does a contest cost?", "When do I get paid?", "logo contest kivabe kaj kore?", "আমার কনটেস্ট কবে শেষ হবে?", "personal logo for my brand"]) {
      expect(wantsHuman(s), s).toBe(false);
    }
  });

  it("replies are plain text, not too long", () => {
    expect(cleanReply("## Prices\n**Starter** is ৳3,000\n- Growth\n* Pro\n\n\n\nThanks")).toBe("Prices\nStarter is ৳3,000\n• Growth\n• Pro\n\nThanks");
    expect(cleanReply("x".repeat(2000))).toHaveLength(1500);
    expect(cleanReply(42)).toBe("");
  });

  it("the AI's answer is checked: a reply is needed, and a handover always has a reason", () => {
    expect(readAnswer({ reply: "Hello", handover: false, reason: "ignored" })).toEqual({ reply: "Hello", handover: false, reason: "" });
    expect(readAnswer({ reply: "A team member will reply.", handover: true, reason: "" })).toEqual({ reply: "A team member will reply.", handover: true, reason: "The person needs a team member." });
    expect(readAnswer({ reply: "  ", handover: false })).toBeNull();
    expect(readAnswer(null)).toBeNull();
    expect(readAnswer({ reply: "ok", handover: "yes", reason: "x" })?.handover).toBe(false);
  });

  it("the conversation keeps the last messages, labelled", () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({ who: (i % 2 ? "assistant" : "person") as "assistant" | "person", text: `m${i}` }));
    const text = conversationText(lines);
    expect(text.split("\n\n")).toHaveLength(16);
    expect(text.startsWith("Person: m4")).toBe(true);
    expect(conversationText([{ who: "team", text: "Hi" }])).toBe("Team member: Hi");
  });

  it("the instructions carry the rules, the site information and the person", () => {
    const p = systemPrompt({ role: "client", siteInfo: "Q: How much?\nA: ৳3,000", person: "Name: Rahim", pages: "Start: https://logocontest.bd/start" });
    expect(p).toContain("signed-in client");
    expect(p).toContain("Banglish");
    expect(p).toContain("never passwords or codes");
    expect(p).toContain("SITE INFORMATION:\nQ: How much?");
    expect(p).toContain("PERSON:\nName: Rahim");
    expect(p).toContain("https://logocontest.bd/start");
  });

  it("modes and the daily reset", () => {
    expect(["ai", "waiting", "human"].every(isThreadMode)).toBe(true);
    expect(isThreadMode("closed")).toBe(false);
    // 23:30 in Dhaka on the 15th is 17:30 UTC; the day started at 18:00 UTC on the 14th.
    expect(dhakaMidnight(new Date("2026-10-15T17:30:00Z")).toISOString()).toBe("2026-10-14T18:00:00.000Z");
    expect(dhakaMidnight(new Date("2026-10-15T18:30:00Z")).toISOString()).toBe("2026-10-15T18:00:00.000Z");
  });
});

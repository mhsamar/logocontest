import { describe, expect, it } from "vitest";
import { findBadWord } from "@/lib/moderation/bad-words";

describe("bad words in comments (owner, 2026-10-12)", () => {
  it("finds English, Banglish and Bangla bad words", () => {
    expect(findBadWord("this is SHIT")).toBe("shit");
    expect(findBadWord("what the fucking logo")).toBe("fucking");
    expect(findBadWord("tui ekta gandu")).toBe("gandu");
    expect(findBadWord("ki bal er design")).toBe("bal");
    expect(findBadWord("তুই একটা বোকাচোদা")).toBe("বোকাচোদা");
    expect(findBadWord("হারামজাদা!")).toBe("হারামজাদা");
  });

  it("matches whole words only", () => {
    expect(findBadWord("Nice work, Dickens style")).toBeNull();
    expect(findBadWord("a balloon and a ball")).toBeNull();
    expect(findBadWord("বালিশ আর বালতি")).toBeNull();
    expect(findBadWord("Please make the colors brighter")).toBeNull();
  });
});

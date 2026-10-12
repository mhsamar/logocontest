import { describe, expect, it } from "vitest";
import { isLanguageKey, isSkillLevel, levelPercent, toolTile } from "@/lib/designers/portfolio-options";

describe("designer profile extras (owner, 2026-10-12)", () => {
  it("shows tools as a 2-letter tile and text, never a logo", () => {
    expect(toolTile("illustrator").code).toBe("Ai");
    expect(toolTile("figma").code).toBe("Fg");
    expect(toolTile("Canva").code).toBe("Ca");
    expect(toolTile("  ").code).toBe("•");
  });
  it("turns a skill level into a bar width", () => {
    expect(levelPercent("learning")).toBe(25);
    expect(levelPercent("expert")).toBe(100);
    expect(isSkillLevel("strong")).toBe(true);
    expect(isSkillLevel("master")).toBe(false);
  });
  it("knows the listed languages", () => {
    expect(isLanguageKey("bangla")).toBe(true);
    expect(isLanguageKey("klingon")).toBe(false);
  });
});

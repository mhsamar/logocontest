import { describe, expect, it } from "vitest";
import { profilePercent, profileSteps, type ProfileFacts } from "@/lib/profile/completeness";

const fresh: ProfileFacts = { avatarUrl: null, bio: "I make clean logos.", skills: [], tools: [], experienceYears: null, languages: [], emailVerified: false };

describe("profile completeness", () => {
  it("a designer straight after sign-up has only the bio done", () => {
    const steps = profileSteps(fresh);
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(["bio"]);
    expect(profilePercent(steps)).toBe(14);
  });

  it("everything filled is 100%", () => {
    const steps = profileSteps({ avatarUrl: "/a.png", bio: "Hi", skills: ["Logo"], tools: ["Illustrator"], experienceYears: 0, languages: ["bn"], emailVerified: true });
    expect(profilePercent(steps)).toBe(100);
  });

  it("languages are not asked for before they can be saved", () => {
    const steps = profileSteps({ ...fresh, languages: null });
    expect(steps.map((s) => s.key)).not.toContain("languages");
    expect(steps).toHaveLength(6);
  });

  it("a blank bio does not count", () => {
    expect(profileSteps({ ...fresh, bio: "   " }).find((s) => s.key === "bio")?.done).toBe(false);
  });
});

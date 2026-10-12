import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { showsLink } = await import("@/lib/rewards/program");

describe("monthly prizes program switch (owner, 2026-10-13)", () => {
  it("drops the leaderboard links only while the program is off", () => {
    const off = { program: false };
    const on = { program: true };
    expect(showsLink("/leaderboard", off)).toBe(false);
    expect(showsLink("/leaderboard?month=2026-09", off)).toBe(false);
    expect(showsLink("/leaderboard#rules", off)).toBe(false);
    expect(showsLink("/leaderboard", on)).toBe(true);
    expect(showsLink("/leaderboards-of-something-else", off)).toBe(true);
    expect(showsLink("/contests", off)).toBe(true);
    expect(showsLink(undefined, off)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { countdownParts, countdownTone, countdownUsed, firstFilesDeadline } from "@/lib/handover/countdown";

const H = 3_600_000;

describe("winner delivery stopwatch", () => {
  it("is due the strike hours after the pick", () => {
    expect(firstFilesDeadline(new Date("2026-11-24T10:00:00Z"), 24).toISOString()).toBe("2026-11-25T10:00:00.000Z");
  });

  it("splits the time left into hours, minutes and seconds, and stops at zero", () => {
    expect(countdownParts(23 * H + 59 * 60_000 + 58_000)).toEqual({ h: 23, m: 59, s: 58 });
    expect(countdownParts(30 * H)).toEqual({ h: 30, m: 0, s: 0 });
    expect(countdownParts(-5000)).toEqual({ h: 0, m: 0, s: 0 });
  });

  it("turns amber under 6 hours, red under 1 hour, and over at the deadline", () => {
    expect(countdownTone(10 * H)).toBe("calm");
    expect(countdownTone(5 * H)).toBe("soon");
    expect(countdownTone(30 * 60_000)).toBe("urgent");
    expect(countdownTone(0)).toBe("over");
  });

  it("the bar fills as the time is used", () => {
    expect(countdownUsed(24 * H, 24 * H)).toBe(0);
    expect(countdownUsed(12 * H, 24 * H)).toBe(0.5);
    expect(countdownUsed(-H, 24 * H)).toBe(1);
  });
});

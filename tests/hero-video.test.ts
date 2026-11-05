import { describe, expect, it } from "vitest";
import { clock, parseClock, shouldAutoMute } from "@/components/home/landing/hero-video-rules";
import { parseVideoUrl } from "@/lib/home/how-video";
import { SETTINGS } from "@/lib/settings/registry";

/** The home hero video (owner, 2026-11-06; Design/logocontest-update/HomeHeroVideo). */
describe("home hero video", () => {
  it("takes any form of YouTube link", () => {
    for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"]) expect(parseVideoUrl(u)?.id).toBe("dQw4w9WgXcQ");
    expect(parseVideoUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("writes and reads chapter times", () => {
    expect([clock(0), clock(15), clock(75), clock(3725)]).toEqual(["0:00", "0:15", "1:15", "1:02:05"]);
    expect([parseClock("0:15"), parseClock("1:15"), parseClock("50"), parseClock("1:02:05")]).toEqual([15, 75, 50, 3725]);
    expect([parseClock(""), parseClock("1:75"), parseClock("abc")]).toEqual([null, null, null]);
  });

  it("loops muted after one full play heard with sound, only once", () => {
    expect(shouldAutoMute({ heardFrom: 0, muted: false, alreadyHeard: false })).toBe(true);
    expect(shouldAutoMute({ heardFrom: 20, muted: false, alreadyHeard: false })).toBe(false);
    expect(shouldAutoMute({ heardFrom: 0, muted: true, alreadyHeard: false })).toBe(false);
    expect(shouldAutoMute({ heardFrom: 0, muted: false, alreadyHeard: true })).toBe(false);
  });

  it("starts with the owner's four chapters, on and with sound", () => {
    expect(SETTINGS["hero.video_chapters"].default.map((c) => c.at)).toEqual([0, 15, 35, 50]);
    expect(SETTINGS["hero.video_on"].default).toBe(true);
    expect(SETTINGS["hero.video_sound"].default).toBe(true);
    expect(SETTINGS["hero.video_chapters"].schema.safeParse([{ at: 5, label: "" }]).success).toBe(false);
  });
});

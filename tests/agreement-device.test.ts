import { describe, expect, it } from "vitest";
import { describeDevice } from "@/lib/agreements/device";

describe("device from the saved browser text (owner, 2026-10-12)", () => {
  it("reads common phones and computers", () => {
    expect(describeDevice("Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36")).toEqual({ browser: "Chrome", device: "androidPhone" });
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")).toEqual({ browser: "Safari", device: "iphone" });
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0")).toEqual({ browser: "Edge", device: "windows" });
    expect(describeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Gecko/20100101 Firefox/131.0")).toEqual({ browser: "Firefox", device: "mac" });
    expect(describeDevice("Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36")).toEqual({ browser: "Samsung Internet", device: "androidPhone" });
  });
  it("shows nothing when nothing was saved", () => {
    expect(describeDevice(null)).toBeNull();
    expect(describeDevice("")).toBeNull();
  });
});

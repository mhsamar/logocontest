import { describe, expect, it } from "vitest";
import { cityFrom, deviceFromUserAgent, ipFrom } from "@/lib/auth/device";

describe("where a login came from (owner, 2026-10-14)", () => {
  it("reads the device, browser and system", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36")).toEqual({ device: "mobile", browser: "Chrome", os: "Android" });
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toEqual({ device: "mobile", browser: "Safari", os: "iOS" });
    expect(deviceFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1")).toEqual({ device: "tablet", browser: "Safari", os: "iOS" });
    expect(deviceFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0")).toEqual({ device: "desktop", browser: "Edge", os: "Windows" });
    expect(deviceFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15")).toEqual({ device: "desktop", browser: "Safari", os: "macOS" });
    expect(deviceFromUserAgent(null)).toEqual({ device: "desktop", browser: null, os: null });
  });

  it("IP address and city from the host's headers", () => {
    expect(ipFrom("103.12.4.9, 10.0.0.1")).toBe("103.12.4.9");
    expect(ipFrom(null, "1.2.3.4")).toBe("1.2.3.4");
    expect(ipFrom(null)).toBeNull();
    expect(cityFrom("Dhaka")).toBe("Dhaka");
    expect(cityFrom("S%C3%A3o%20Paulo")).toBe("São Paulo");
    expect(cityFrom(null)).toBeNull();
  });
});

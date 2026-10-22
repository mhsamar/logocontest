import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/i18n/messages";
import { appManifest } from "@/lib/push/app-manifest";

const text = (locale: "en" | "bn", key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), MESSAGES[locale]);

// What the "Phone notifications" switch can show (src/lib/push/use-push-device.ts: PushState and PushNote).
const STATES = ["on", "blocked", "iphone", "unsupported"];
const NOTES = ["turnedOn", "failed", "testSent", "testFailed", "driverOff"];

describe("Phone notifications on each device (owner, 2026-10-22)", () => {
  it("every state and message has its words in both languages, for designers, clients and the team", () => {
    const keys = [
      ...[...STATES, ...NOTES, "leadDesigner", "leadClient", "title", "subtitle", "turnOn", "turnOnAgain", "test", "later", "promptTitle", "promptBody", "testDesigner", "testClient"].map((k) => `push.device.${k}`),
      ...[...STATES, ...NOTES, "off", "title", "turnOn", "turnOnAgain", "test", "testBody"].map((k) => `admin.push.${k}`),
    ];
    for (const locale of ["en", "bn"] as const) for (const k of keys) expect(typeof text(locale, k), `${locale} ${k}`).toBe("string");
  });

  it("each signed-in area opens as its own Home Screen app, at its own start page", async () => {
    const res = appManifest({ id: "/dashboard", name: "logocontest.bd", shortName: "logocontest", startUrl: "/dashboard" });
    expect(res.headers.get("content-type")).toBe("application/manifest+json");
    const m = (await res.json()) as Record<string, unknown>;
    expect(m).toMatchObject({ id: "/dashboard", start_url: "/dashboard", scope: "/", display: "standalone" });
  });
});

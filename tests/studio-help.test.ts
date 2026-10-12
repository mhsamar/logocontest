import { describe, expect, it } from "vitest";
import { isPublicDesign } from "@/lib/entries/rules";
import { parseStudioQuery, previewSide, startOfDhakaDay, stripIndex, studioHref } from "@/lib/studio/options";
import { liveChatConfig, messengerLink, whatsappLink } from "@/lib/site";

const contest = { status: "open", isPrivate: false, isBlind: false, winnerIsPublic: false };

describe("isPublicDesign (Design Studio, designer profiles)", () => {
  it("shows active, winning and forfeited designs of public contests", () => {
    expect(isPublicDesign({ status: "active" }, contest)).toBe(true);
    expect(isPublicDesign({ status: "winner" }, { ...contest, status: "completed" })).toBe(true);
    expect(isPublicDesign({ status: "forfeited" }, { ...contest, status: "completed" })).toBe(true);
  });
  it("never shows rejected, withdrawn or removed designs", () => {
    for (const status of ["rejected", "withdrawn", "removed"] as const) expect(isPublicDesign({ status }, contest)).toBe(false);
  });
  it("hides private contests and contests that aren't public", () => {
    expect(isPublicDesign({ status: "active" }, { ...contest, isPrivate: true })).toBe(false);
    for (const status of ["draft", "pending_payment", "cancelled"]) expect(isPublicDesign({ status: "active" }, { ...contest, status })).toBe(false);
  });
  it("shows only the public winner of a completed blind contest", () => {
    const blind = { ...contest, isBlind: true };
    expect(isPublicDesign({ status: "active" }, blind)).toBe(false);
    expect(isPublicDesign({ status: "winner" }, { ...blind, status: "winner_selected", winnerIsPublic: true })).toBe(false);
    expect(isPublicDesign({ status: "winner" }, { ...blind, status: "completed", winnerIsPublic: false })).toBe(false);
    expect(isPublicDesign({ status: "winner" }, { ...blind, status: "completed", winnerIsPublic: true })).toBe(true);
  });
});

describe("Design Studio options", () => {
  it("reads the URL and falls back to the defaults", () => {
    expect(parseStudioQuery({})).toEqual({ tab: "all", q: "", type: null, sort: "newest" });
    expect(parseStudioQuery({ tab: "new", q: "  Nodi   tea ", sort: "files" })).toEqual({ tab: "new", q: "Nodi tea", type: null, sort: "files" });
    expect(parseStudioQuery({ tab: "x", sort: "x", type: "not-a-type" })).toEqual({ tab: "all", q: "", type: null, sort: "newest" });
    // The old ?filter=winners link still works.
    expect(parseStudioQuery({ filter: "winners" }).tab).toBe("winners");
  });
  it("writes short links with only what differs from the defaults", () => {
    const q = parseStudioQuery({});
    expect(studioHref(q)).toBe("/design-studio");
    expect(studioHref(q, { tab: "winners", sort: "oldest" })).toBe("/design-studio?tab=winners&sort=oldest");
    expect(studioHref({ ...q, q: "rafi" }, { tab: "all" })).toBe("/design-studio?q=rafi");
  });
  it("splits a card into one equal strip per file", () => {
    expect(stripIndex(0, 200, 8)).toBe(0);
    expect(stripIndex(24, 200, 8)).toBe(0);
    expect(stripIndex(26, 200, 8)).toBe(1);
    expect(stripIndex(199, 200, 8)).toBe(7);
    expect(stripIndex(250, 200, 8)).toBe(7);
    expect(stripIndex(-5, 200, 3)).toBe(0);
    expect(stripIndex(150, 200, 1)).toBe(0);
  });
  it("opens the preview on the side with more room, and upward near the bottom", () => {
    const view = { width: 1400, height: 900 };
    const pv = { width: 520, height: 710 };
    expect(previewSide({ left: 30, right: 250, top: 100 }, view, pv)).toEqual({ x: "right", y: "down" });
    expect(previewSide({ left: 1150, right: 1370, top: 100 }, view, pv)).toEqual({ x: "left", y: "down" });
    expect(previewSide({ left: 30, right: 250, top: 600 }, view, pv)).toEqual({ x: "right", y: "up" });
  });
  it("counts today from midnight in Bangladesh", () => {
    // 2026-10-08 01:00 in Dhaka is 2026-10-07 19:00 UTC; the day started at 2026-10-07 18:00 UTC.
    expect(startOfDhakaDay(new Date("2026-10-07T19:00:00Z"))).toBe("2026-10-07T18:00:00.000Z");
    expect(startOfDhakaDay(new Date("2026-10-08T17:59:00Z"))).toBe("2026-10-07T18:00:00.000Z");
    expect(startOfDhakaDay(new Date("2026-10-08T18:00:00Z"))).toBe("2026-10-08T18:00:00.000Z");
  });
});

describe("Help page links", () => {
  it("builds a WhatsApp link with the country code and an encoded greeting", () => {
    expect(whatsappLink("01712028511")).toBe("https://wa.me/8801712028511");
    expect(whatsappLink("01712028511", "Hi there!")).toBe("https://wa.me/8801712028511?text=Hi%20there!");
  });
  it("builds a Messenger link from a Facebook page link", () => {
    expect(messengerLink("https://www.facebook.com/Businessviewbd/")).toBe("https://m.me/Businessviewbd");
    expect(messengerLink("https://www.facebook.com/profile.php?id=1234567")).toBe("https://m.me/1234567");
    expect(messengerLink("https://www.facebook.com/groups/abc")).toBeNull();
    expect(messengerLink("")).toBeNull();
  });
  it("turns Tawk.to on only when switched on with both IDs", () => {
    const ids = { tawkPropertyId: "0123456789abcdef01234567", tawkWidgetId: "1abcdefgh" };
    expect(liveChatConfig({ driver: "tawk", ...ids })).toEqual({ driver: "tawk", src: "https://embed.tawk.to/0123456789abcdef01234567/1abcdefgh" });
    expect(liveChatConfig({ driver: "none", ...ids })).toEqual({ driver: "none" });
    expect(liveChatConfig({ driver: "tawk", ...ids, tawkWidgetId: "" })).toEqual({ driver: "none" });
    expect(liveChatConfig({ driver: "tawk", ...ids, tawkPropertyId: "bad/../id" })).toEqual({ driver: "none" });
  });
});

describe("contest number (owner, 2026-10-08)", () => {
  it("pads to five digits and grows past them", async () => {
    const { formatContestNumber } = await import("@/lib/contests/number");
    expect(formatContestNumber(1, "en")).toBe("#00001");
    expect(formatContestNumber(42, "en")).toBe("#00042");
    expect(formatContestNumber(123456, "en")).toBe("#123456");
    expect(formatContestNumber(7, "bn")).toBe("#০০০০৭");
  });
});

describe("landing page after login (owner, 2026-10-08)", () => {
  it("sends each role to its own page", async () => {
    const { homeForRole } = await import("@/lib/auth/home");
    expect(homeForRole("client")).toBe("/dashboard");
    expect(homeForRole("designer")).toBe("/contests");
    expect(homeForRole("admin")).toBe("/admin");
    expect(homeForRole(undefined)).toBe("/");
  });
});

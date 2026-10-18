import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeUrl, dueForPin, MAX_ATTEMPTS, needsRefresh, pinKindFor, pinText, PINTEREST_SCOPES } from "@/lib/pinterest/rules";
import { parseSetting } from "@/lib/settings/registry";

vi.mock("server-only", () => ({}));

// Pinterest auto-posting (owner, 2026-10-19).
describe("Pinterest login link", () => {
  it("goes to Pinterest's own login with our app, our callback, a state and only the scopes we need", () => {
    const u = new URL(authorizeUrl({ clientId: "1626344", redirectUri: "https://logocontest.bd/api/pinterest/callback", state: "abc" }));
    expect(u.origin + u.pathname).toBe("https://www.pinterest.com/oauth/");
    expect(u.searchParams.get("client_id")).toBe("1626344");
    expect(u.searchParams.get("redirect_uri")).toBe("https://logocontest.bd/api/pinterest/callback");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("state")).toBe("abc");
    expect(u.searchParams.get("scope")).toBe("boards:read,pins:read,pins:write,user_accounts:read");
    expect(PINTEREST_SCOPES).not.toContain("ads:write");
  });
});

describe("what gets pinned", () => {
  const pub = { status: "completed", isPrivate: false, isNda: false, isBlind: false, winnerIsPublic: false };
  it("winners only (the default): just the winning design", () => {
    expect(pinKindFor("winners", { status: "winner" }, pub)).toBe("winner");
    expect(pinKindFor("winners", { status: "active" }, pub)).toBeNull();
  });
  it("winners plus public designs: approved designs too, never forfeited, held or rejected", () => {
    expect(pinKindFor("winners_public", { status: "active" }, { ...pub, status: "open" })).toBe("design");
    for (const status of ["forfeited", "held", "rejected", "withdrawn", "removed"] as const) expect(pinKindFor("winners_public", { status }, pub)).toBeNull();
  });
  it("never private, NDA or unpaid contests", () => {
    expect(pinKindFor("winners", { status: "winner" }, { ...pub, isPrivate: true })).toBeNull();
    expect(pinKindFor("winners", { status: "winner" }, { ...pub, isNda: true })).toBeNull();
    expect(pinKindFor("winners_public", { status: "active" }, { ...pub, status: "draft" })).toBeNull();
  });
  it("blind contests: only a winner the client made public", () => {
    const blind = { ...pub, isBlind: true };
    expect(pinKindFor("winners_public", { status: "active" }, blind)).toBeNull();
    expect(pinKindFor("winners", { status: "winner" }, blind)).toBeNull();
    expect(pinKindFor("winners", { status: "winner" }, { ...blind, winnerIsPublic: true })).toBe("winner");
  });
  it("a Pro designer's hidden design waits until the winner is picked", () => {
    expect(pinKindFor("winners_public", { status: "active", isHidden: true }, { ...pub, status: "open" })).toBeNull();
    expect(pinKindFor("winners_public", { status: "active", isHidden: true }, pub)).toBe("design");
  });
});

describe("retries", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);
  it("new designs go at once; posted ones never again", () => {
    expect(dueForPin(null, now)).toBe(true);
    expect(dueForPin({ status: "posted", attempts: 1, createdAt: ago(10) }, now)).toBe(false);
  });
  it("failed ones wait an hour longer each time, three tries at most", () => {
    expect(dueForPin({ status: "failed", attempts: 1, createdAt: ago(300), lastTryAt: ago(30) }, now)).toBe(false);
    expect(dueForPin({ status: "failed", attempts: 1, createdAt: ago(300), lastTryAt: ago(61) }, now)).toBe(true);
    expect(dueForPin({ status: "failed", attempts: 2, createdAt: ago(300), lastTryAt: ago(90) }, now)).toBe(false);
    expect(dueForPin({ status: "failed", attempts: MAX_ATTEMPTS, createdAt: ago(9999), lastTryAt: ago(9999) }, now)).toBe(false);
  });
});

describe("pin texts", () => {
  it("fit Pinterest's limits and say what it is", () => {
    const w = pinText({ brand: "Nodi Tea House", number: 1, designer: "@rafi_designs", kind: "winner" });
    expect(w.title).toBe("Winning logo for Nodi Tea House");
    expect(w.description).toContain("by @rafi_designs");
    const long = pinText({ brand: "X".repeat(200), number: 12, designer: null, kind: "design", service: "business_card" });
    expect(long.title.length).toBeLessThanOrEqual(100);
    expect(long.description.length).toBeLessThanOrEqual(500);
    expect(long.title.startsWith("Design idea #12")).toBe(true);
  });
  it("tokens are refreshed two days before they end", () => {
    const now = new Date("2026-10-19T00:00:00Z");
    expect(needsRefresh(null, now)).toBe(true);
    expect(needsRefresh(new Date("2026-10-20T12:00:00Z"), now)).toBe(true);
    expect(needsRefresh(new Date("2026-10-25T00:00:00Z"), now)).toBe(false);
  });
});

describe("settings and safety", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("starts off, with winners only", () => {
    expect(parseSetting("pinterest.on", undefined)).toBe(false);
    expect(parseSetting("pinterest.rule", undefined)).toBe("winners");
  });
  it("tokens are stored sealed and can't be read with another app secret", async () => {
    vi.stubEnv("PINTEREST_APP_SECRET", "first-secret");
    const { sealToken, openToken } = await import("@/lib/pinterest/api");
    const sealed = sealToken("pina_token_123");
    expect(sealed).not.toContain("pina_token_123");
    expect(openToken(sealed)).toBe("pina_token_123");
    vi.stubEnv("PINTEREST_APP_SECRET", "another-secret");
    expect(openToken(sealed)).toBeNull();
  });
  it("the login callback checks the one-time state and admin rights; keys stay on the server", () => {
    const cb = readFileSync("src/app/api/pinterest/callback/route.ts", "utf8");
    expect(cb).toContain('adminUser("content.manage")');
    expect(cb).toContain("timingSafeEqual");
    expect(cb).toContain('req.cookies.get("lc_pin_state")');
    const api = readFileSync("src/lib/pinterest/api.ts", "utf8");
    expect(api).toContain('import "server-only"');
    expect(readFileSync("src/app/api/cron/lifecycle/route.ts", "utf8")).toMatch(/runLifecycle\(\);[\s\S]*runPinterest\(\)\.catch/);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

// robots.txt (owner, 2026-10-18): before launch only link-preview robots and Pinterest may read the public pages.
describe("robots.txt", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("before launch: search engines are blocked, link previews and Pinterest can read public pages", async () => {
    vi.stubEnv("SEO_NOINDEX", "true");
    const { default: robots } = await import("@/app/robots");
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const share = rules.find((x) => Array.isArray(x.userAgent) && x.userAgent.includes("Pinterestbot"))!;
    expect(share.userAgent).toEqual(expect.arrayContaining(["Pinterestbot", "facebookexternalhit", "WhatsApp"]));
    expect(share.allow).toBe("/");
    expect(share.disallow).toEqual(expect.arrayContaining(["/dashboard", "/admin", "/api"]));
    expect(rules.find((x) => x.userAgent === "*")?.disallow).toBe("/");
    expect(r.sitemap).toBeUndefined();
  });
  it("the Pinterest site check code is on every page", async () => {
    const src = (await import("node:fs")).readFileSync("src/app/layout.tsx", "utf8");
    expect(src).toContain('"p:domain_verify": "cb536e9e87dbc7662f94b8400e106a79"');
  });
});

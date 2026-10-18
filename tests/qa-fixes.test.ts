import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

// Fixes from the full site QA (owner, 2026-10-18).
describe("QA fixes", () => {
  it("every response carries the security headers", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    const h = Object.fromEntries(all.headers.map((x) => [x.key, x.value]));
    expect(h["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(h["Content-Security-Policy"]).toBe("frame-ancestors 'self'");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
  });

  it("/favicon.ico goes to the site icon", async () => {
    const rules = await nextConfig.redirects!();
    expect(rules).toContainEqual(expect.objectContaining({ source: "/favicon.ico", destination: "/icon", permanent: false }));
  });

  it("a logged-out visitor on the client workspace goes straight to the client login", () => {
    const src = readFileSync("src/proxy.ts", "utf8");
    expect(src).toMatch(/!userId && isPage && \(pathname === "\/client" \|\| pathname\.startsWith\("\/client\/"\)\)/);
    expect(src).toContain("?as=client&next=");
  });

  it("winning logos are all square cards", () => {
    expect(readFileSync("src/app/winners/page.tsx", "utf8")).not.toContain("tall=");
    expect(readFileSync("src/components/rewards/design-tile.tsx", "utf8")).not.toContain("aspect-[4/5]");
  });

  it("visit counters never throw when an ad-blocker stops them", () => {
    for (const f of ["src/components/layout/visit-tracker.tsx", "src/components/visitor-popup/visitor-popup.tsx", "src/components/pro/upgrade-link.tsx", "src/components/pro/entry-view-beacon.tsx"]) {
      const src = readFileSync(f, "utf8");
      for (const call of src.match(/void fetch\([^;]+;/g) ?? []) expect(call, f).toContain(".catch(");
    }
  });

  it("pages without a brief or bio still have a description", () => {
    expect(readFileSync("src/app/contest/[slug]/page.tsx", "utf8")).toContain('t("contest.metaDescription"');
    for (const f of ["src/app/d/[username]/page.tsx", "src/app/designer/[username]/page.tsx"]) expect(readFileSync(f, "utf8")).toContain('t("designerProfile.metaDescription"');
  });
});

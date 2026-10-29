import sharp from "sharp";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-10-28: "site aita aikhane e chalabo … bill bashi hoibo na, site slow hoibo na". Staying on Vercel and
// Supabase: fewer billed server runs (link prefetch, pings, the proxy on background routes), less Supabase egress
// (site pictures and design pictures cached), and fewer waits on the busiest pages.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const st = vi.hoisted(() => ({ downloads: [] as string[], file: null as Uint8Array | null }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn, updateTag: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        download: async (p: string) => (st.downloads.push(p), st.file ? { data: new Blob([st.file as BlobPart]), error: null } : { data: null, error: { message: "missing" } }),
      }),
    },
  }),
}));

beforeEach(() => {
  st.downloads = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.supabase.co";
});

describe("fewer billed server runs", () => {
  it("links don't fetch their page ahead of time (only the client workspace menu does)", () => {
    expect(read("src/components/ui/link.tsx")).toContain("<NextLink prefetch={false} {...props} />");
    const direct = execSync(`grep -rln 'from "next/link"' src || true`, { encoding: "utf8" }).split("\n").filter(Boolean).sort();
    expect(direct).toEqual(["src/components/client/menu-nav.tsx", "src/components/ui/link.tsx"]);
  });

  it("the proxy skips background pings, jobs, webhooks, share pictures and files for search engines", () => {
    const proxy = read("src/proxy.ts");
    for (const p of ["api/site-img/", "api/track$", "api/wizard/live$", "api/live-designers$", "api/cron/", "api/cards/win/", "api/cards/monthly/", "api/payments/stripe/", "api/popup-event$", "api/pro/view$", "api/pro/event$", ".*opengraph-image", "sitemap\\\\.xml$", "robots\\\\.txt$"]) expect(proxy, p).toContain(`|${p}|`);
  });

  it("pings: visits once a minute, the wizard every 20 s, the rest only while in use", async () => {
    const { HEARTBEAT_MS, ONLINE_MS } = await import("@/lib/analytics/rules");
    expect(HEARTBEAT_MS).toBe(60_000);
    expect(HEARTBEAT_MS).toBeLessThan(ONLINE_MS);
    const { LIVE_BEAT_MS, OFFER_FRESH_MS } = await import("@/lib/wizard-live-rules");
    expect(LIVE_BEAT_MS).toBe(20_000);
    // Checked every 5 s from the last send, so the longest gap is about LIVE_BEAT_MS + 5 s.
    expect(LIVE_BEAT_MS + 5_000).toBeLessThan(OFFER_FRESH_MS);
    expect(read("src/components/wizard/use-wizard-live.ts")).toContain("}, Math.min(every, 5_000));");
    expect(read("src/components/layout/visit-tracker.tsx")).toContain("if (!document.hasFocus() && Date.now() - lastBeat < ONLINE_MS - 10_000) return;");
    expect(read("src/components/support/support-widget.tsx")).toContain("const id = window.setInterval(check, 120_000);");
    expect(read("src/components/admin/admin-presence.tsx")).toContain('window.setInterval(() => document.visibilityState === "visible" && void beat(), BEAT_MS)');
    expect(read("src/components/admin/admin-nav.tsx")).toContain('const onTick = () => document.visibilityState === "visible" && document.hasFocus() && load();');
    expect(read("src/components/admin/admin-alerts.tsx")).toContain("const EVERY_MS = 30_000;");
  });
});

describe("less Supabase egress", () => {
  it("site pictures go through /api/site-img (never SVG); guide pictures written as Storage links are shown the same way", async () => {
    const { siteImageUrl, siteImageFromUrl, pictureUrl } = await import("@/lib/content/pictures");
    const uuid = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
    expect(siteImageUrl(`hero-slides/${uuid}-800x600.png`)).toBe(`/api/site-img/hero-slides/${uuid}-800x600.png`);
    expect(siteImageUrl(`guides/${uuid}.webp`)).toBe(`/api/site-img/guides/${uuid}.webp`);
    expect(siteImageUrl(`icon/${uuid}.png`)).toBe(`/api/site-img/icon/${uuid}.png`);
    expect(siteImageUrl(`logo/${uuid}.svg`)).toBe(pictureUrl(`logo/${uuid}.svg`));
    expect(siteImageUrl(null)).toBeNull();
    expect(siteImageFromUrl(`https://db.supabase.co/storage/v1/object/public/site/guides/${uuid}.png`)).toBe(`/api/site-img/guides/${uuid}.png`);
    expect(siteImageFromUrl("https://elsewhere.com/a.png")).toBe("https://elsewhere.com/a.png");
    // The brand logo, icon and hero use it; the share picture keeps its public link for the share card.
    expect(read("src/lib/content/brand.ts")).toContain('return { logo: siteImageUrl(s["brand.logo"]), icon: siteImageUrl(s["brand.icon"]), hero: siteImageUrl(s["brand.hero"]), share: pictureUrl(s["brand.share"]) };');
    expect(read("src/lib/home/hero.ts")).toContain('(siteImageUrl(path) ?? "")');
  });

  it("the route sends photos as WebP and the icon as it is, kept for a year; nothing else", async () => {
    const { GET } = await import("@/app/api/site-img/[...path]/route");
    const uuid = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
    st.file = new Uint8Array(await sharp({ create: { width: 900, height: 600, channels: 3, background: "#8b0000" } }).png().toBuffer());
    const call = (path: string) => GET(new Request("https://x"), { params: Promise.resolve({ path: path.split("/") }) });
    const photo = await call(`hero-slides/${uuid}-900x600.png`);
    expect(photo.headers.get("content-type")).toBe("image/webp");
    expect(photo.headers.get("cache-control")).toBe("public, max-age=31536000, s-maxage=31536000, immutable");
    const icon = await call(`icon/${uuid}.png`);
    expect(icon.headers.get("content-type")).toBe("image/png");
    for (const bad of [`logo/${uuid}.svg`, "previews/a.jpg", `../${uuid}.png`, `guides/${uuid}.gif`]) expect((await call(bad)).status, bad).toBe(404);
    expect(read("src/lib/content/icon-route.ts")).toContain('"Cache-Control": "public, max-age=300, s-maxage=3600"');
  });

  it("design pictures are converted once a month per width, not twice a day", () => {
    const img = read("src/app/api/img/[token]/route.ts");
    expect(img).toContain('["img-v1"],\n  { revalidate: 30 * 86400 },');
    expect(img).toContain("await converted(t.bucket, t.path, t.width)");
    expect(read("scripts/backup-files.mjs")).toContain('const root = path.join("backups", "files");');
  });
});

describe("fewer waits", () => {
  it("Pro settings and the home logos are kept and cleared by every save", () => {
    expect(read("src/lib/pro/settings.ts")).toContain('["pro-settings-v1"],\n  { tags: [PRO_SETTINGS_TAG], revalidate: 300 },');
    expect(read("src/lib/pro/admin-actions.ts").match(/proSettingsChanged\(\);/g)?.length).toBe(3);
    expect(read("src/lib/home/logos.ts")).toContain('["home-logos-v1"], { tags: [HOME_LOGOS_TAG], revalidate: 300 }');
    expect(read("src/lib/admin/site-actions.ts").match(/homeLogosChanged\(\);/g)?.length).toBe(3);
    // Every file that writes pro_settings or featured_logos clears its cache.
    for (const [table, call] of [["pro_settings", "proSettingsChanged();"], ["featured_logos", "homeLogosChanged();"]]) {
      const writers = execSync(`grep -rlE 'from\\("${table}"\\)\\.(update|insert|delete|upsert)' src || true`, { encoding: "utf8" }).split("\n").filter(Boolean);
      for (const f of writers) expect(read(f), `${f} writes ${table}`).toContain(call);
    }
  });

  it("visitors on the home page share a list kept for a minute, with real dates", async () => {
    // The new home carousel (owner, 2026-10-29): a light list, shared by visitors for a minute; dates stay text.
    expect(read("src/app/page.tsx")).toContain("carouselContests(user ?? null)");
    expect(read("src/lib/home/carousel.ts")).toContain('["home-carousel-v2"], { revalidate: 60 }');
  });

  it("the contest page reads at the same time, and checks early access before showing anything", () => {
    const page = read("src/app/contest/[slug]/page.tsx");
    expect(page).toContain("const [visible, svc, [judgingDays,");
    expect(page.indexOf("if (!visible) return <EarlyAccessGate")).toBeLessThan(page.indexOf("const [badges, trials, chattable, viewerIsPro, reportCheck] = await Promise.all(["));
    expect(read("src/lib/contests/browse.ts")).toContain('canSeeBrief ? db.from("contest_files").select("path, original_name, mime_type").eq("contest_id", data.id).order("created_at") : null,');
  });

  it("the login is checked on the server without a network call; hero slides after the first load after the page", () => {
    const session = read("src/lib/auth/session.ts");
    expect(session).toContain("const { data } = await supabase.auth.getClaims();");
    // An ended login (signed out, password reset, device limit, an admin) is refused at once, as getUser did.
    expect(session).toContain('.from("user_sessions")');
    expect(session).toContain("if (ended) return null;");
    expect(read("src/app/api/track/route.ts")).toContain("auth.getClaims()");
    const slider = read("src/components/home/landing/hero-slider.tsx");
    expect(slider).toContain("{i === 0 || i === active || later ? node : null}");
    expect(slider).toContain("const paused = reduced || hidden || hover || typing || count < 2 || !later;");
    expect(read("src/components/home/landing/hero-showcase.tsx")).toContain('src.startsWith("/api/site-img/")');
    expect(read("src/app/admin/analytics/page.tsx")).toContain('["admin-traffic-v1"]');
  });
});

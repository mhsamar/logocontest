import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readViewImageToken, viewExp, viewImageToken, viewWidth } from "@/lib/storage/view-links";

// Owner, 2026-10-27: Supabase's free 5 GB of egress ran out. Design previews now go through /api/img: fetched from
// Storage once, sent as a light WebP, and kept by Vercel's CDN, so repeat views cost Supabase nothing.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const st = vi.hoisted(() => ({ signed: [] as string[][], downloads: [] as string[], file: null as Uint8Array | null }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/env", () => ({ requireEnv: () => "test-secret", isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => (st.signed.push(paths), { data: paths.map((p) => ({ path: p, signedUrl: `https://supabase/sign/${p}` })), error: null }),
        download: async (p: string) => (st.downloads.push(p), st.file ? { data: new Blob([st.file as BlobPart]), error: null } : { data: null, error: { message: "missing" } }),
      }),
    },
  }),
}));

beforeEach(() => {
  st.signed = [];
  st.downloads = [];
  process.env.OTP_SECRET = "test-secret";
  process.env.SITE_URL = "https://logocontest.bd/";
});

describe("design pictures through the site", () => {
  it("a link names the file, width and end, can't be changed, and stays the same for 12 hours", () => {
    const now = new Date("2026-10-27T10:00:00Z");
    const exp = viewExp(now);
    expect(exp - now.getTime() / 1000).toBeGreaterThanOrEqual(12 * 3600);
    expect(exp - now.getTime() / 1000).toBeLessThanOrEqual(24 * 3600);
    expect(viewExp(new Date(now.getTime() + 60_000))).toBe(exp);
    const token = viewImageToken("s", { bucket: "entry-files", path: "previews/a.jpg", width: 640, exp });
    expect(readViewImageToken("s", token, now)).toEqual({ bucket: "entry-files", path: "previews/a.jpg", width: 640, exp });
    expect(readViewImageToken("other", token, now)).toBeNull();
    expect(readViewImageToken("s", `${token}x`, now)).toBeNull();
    expect(readViewImageToken("s", token, new Date(exp * 1000 + 1))).toBeNull();
    expect([viewWidth(200), viewWidth(300), viewWidth(640), viewWidth(700), viewWidth(undefined), viewWidth(5000)]).toEqual([240, 480, 640, 1000, 1000, 1000]);
  });

  it("previews shown on the site get /api/img links; originals and short links stay signed by Supabase", async () => {
    const { getFileStorage } = await import("@/lib/storage");
    const got = await getFileStorage().createReadUrls("entry-files", ["previews/a.jpg", "originals/a.ai"], 3600, { width: 640 });
    expect(got.get("previews/a.jpg")).toMatch(/^https:\/\/logocontest\.bd\/api\/img\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(readViewImageToken("test-secret", got.get("previews/a.jpg")!.split("/api/img/")[1])?.width).toBe(640);
    expect(got.get("originals/a.ai")).toBe("https://supabase/sign/originals/a.ai");
    // The logo checker's logo and matches too, never its certificate.
    const checks = await getFileStorage().createReadUrls("logo-checks", ["c1/logo.png", "c1/match-1.png", "c1/certificate.png"], 3600, { width: 240 });
    expect(checks.get("c1/logo.png")).toContain("/api/img/");
    expect(checks.get("c1/match-1.png")).toContain("/api/img/");
    expect(checks.get("c1/certificate.png")).toBe("https://supabase/sign/c1/certificate.png");
    // Win cards ask for 10 minutes: unchanged.
    const short = await getFileStorage().createReadUrls("entry-files", ["previews/b.jpg"], 600);
    expect(short.get("previews/b.jpg")).toBe("https://supabase/sign/previews/b.jpg");
  });

  it("sends a WebP of the asked width that the CDN keeps until the link ends; nothing else is served", async () => {
    const { GET } = await import("@/app/api/img/[token]/route");
    st.file = new Uint8Array(await sharp({ create: { width: 1000, height: 1000, channels: 3, background: "#8b0000" } }).jpeg().toBuffer());
    const exp = viewExp(new Date());
    const ok = await GET(new Request("https://x"), { params: Promise.resolve({ token: viewImageToken("test-secret", { bucket: "entry-files", path: "previews/a.jpg", width: 480, exp }) }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/webp");
    expect(ok.headers.get("cache-control")).toMatch(/^public, max-age=\d+, s-maxage=\d+, immutable$/);
    expect((await sharp(Buffer.from(await ok.arrayBuffer())).metadata()).width).toBe(480);
    for (const bad of [{ bucket: "payment-proofs", path: "previews/a.jpg" }, { bucket: "entry-files", path: "originals/a.ai" }, { bucket: "logo-checks", path: "c1/certificate.png" }, { bucket: "logo-checks", path: "c1/certificate.pdf" }]) {
      const res = await GET(new Request("https://x"), { params: Promise.resolve({ token: viewImageToken("test-secret", { ...bad, width: 480, exp }) }) });
      expect(res.status).toBe(404);
    }
    expect(st.downloads).toEqual(["previews/a.jpg"]);
  });

  it("profile photos: a 256 px WebP through the site; the cards drawn on the server keep the stored photo", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.supabase.co";
    const { avatarUrl } = await import("@/lib/profile/avatar");
    const path = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0/1a2b3c4d-1111-2222-3333-444455556666.webp";
    expect(avatarUrl(path)).toBe(`https://logocontest.bd/api/avatar/${path}`);
    expect(avatarUrl(path, { full: true })).toBe(`https://db.supabase.co/storage/v1/object/public/avatars/${path}`);
    expect(avatarUrl(null)).toBeNull();
    for (const f of ["src/lib/rewards/win-cards.ts", "src/lib/rewards/month-close.ts", "src/lib/wallet/payout-card.ts"]) expect(read(f)).toContain("{ full: true })");
    const { GET } = await import("@/app/api/avatar/[...path]/route");
    st.file = new Uint8Array(await sharp({ create: { width: 512, height: 512, channels: 3, background: "#123456" } }).webp().toBuffer());
    const ok = await GET(new Request("https://x"), { params: Promise.resolve({ path: path.split("/") }) });
    expect(ok.headers.get("content-type")).toBe("image/webp");
    expect((await sharp(Buffer.from(await ok.arrayBuffer())).metadata()).width).toBe(256);
    expect((await GET(new Request("https://x"), { params: Promise.resolve({ path: ["..", "secret.png"] }) })).status).toBe(404);
  });

  it("share pictures take the site's WebP design pictures (as JPEG) and are sent as JPEG; cards and certificates are lighter", () => {
    const share = read("src/lib/share/design.ts");
    expect(share).toContain("if (!/^image\\/webp/.test(type)) return null;");
    expect(share).toContain('url.startsWith("/") ? `${await internalOrigin()}${url}` : url');
    for (const f of ["src/app/opengraph-image.tsx", "src/app/contest/[slug]/opengraph-image.tsx", "src/app/contest/[slug]/pin/route.tsx", "src/app/contest/[slug]/design/[number]/opengraph-image.tsx", "src/app/contest/[slug]/design/[number]/pin/route.tsx"]) expect(read(f), f).toContain("asJpeg(");
    const cards = read("src/lib/cards/store.ts");
    expect(cards).toContain('[`${base}.jpg`, jpg, "image/jpeg"], [`${base}-400.webp`, small, "image/webp"]');
    expect(read("src/lib/cards/template.ts")).toContain("export const CARD_TEMPLATE_VERSION = 3;");
    const run = read("src/lib/logo-check/run.ts");
    expect(run).toContain("const paths = { pdf: `${id}/certificate.pdf`, png: `${id}/certificate.jpg` };");
    expect(run).toContain("if (!check.contest_id) return;");
    expect(read("src/lib/logo-check/report-pdf.ts")).toContain("{ picture: false }");
    expect(read("next.config.ts")).toContain('"/api/entries/report/**": ["./node_modules/@sparticuz/chromium/bin/**"],');
  });

  it("the picture routes skip the login check on every request, and the grid asks for small pictures", () => {
    expect(read("src/proxy.ts")).toContain("api/img/|api/avatar/|api/email/image/|");
    expect(read("src/lib/entries/queries.ts")).toContain("{ width: previewLimit <= 4 ? 640 : 1000 }");
  });
});

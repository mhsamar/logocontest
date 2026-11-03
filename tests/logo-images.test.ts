import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logoFileName, publicImagePath, publicImageToken, readPublicImageToken } from "@/lib/storage/view-links";

// Owner, 2026-11-03: designers' logos in Google Images. Public designs get picture addresses that never change
// (/logo/<token>/<brand>-logo.webp), checked on every load that the design is still public.

const st = vi.hoisted(() => ({ file: null as Uint8Array | null, entry: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/env", () => ({ requireEnv: () => "test-secret", isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q = { select: () => q, eq: () => q, limit: () => q, maybeSingle: async () => ({ data: st.entry ? { entry: st.entry } : null, error: null }) };
      return q;
    },
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://supabase/sign/${p}` })), error: null }),
        download: async () => (st.file ? { data: new Blob([st.file as BlobPart]), error: null } : { data: null, error: { message: "missing" } }),
      }),
    },
  }),
}));

const contest = { status: "completed", is_private: false, is_nda: false, is_blind: false, winner_is_public: true, deleted_at: null };

beforeEach(() => {
  process.env.OTP_SECRET = "test-secret";
  process.env.SITE_URL = "https://logocontest.bd/";
  st.entry = { status: "winner", is_hidden: false, contest };
});

describe("public logo pictures", () => {
  it("a token names a design preview and a width, never ends, and can't be changed", () => {
    const token = publicImageToken("s", { path: "previews/a.jpg", width: 1000 });
    expect(readPublicImageToken("s", token)).toEqual({ path: "previews/a.jpg", width: 1000 });
    expect(publicImageToken("s", { path: "previews/a.jpg", width: 1000 })).toBe(token);
    expect(readPublicImageToken("other", token)).toBeNull();
    expect(readPublicImageToken("s", `${token}x`)).toBeNull();
    // Only design previews (never originals), only the site's widths.
    expect(readPublicImageToken("s", publicImageToken("s", { path: "originals/a.ai", width: 1000 }))).toBeNull();
    expect(readPublicImageToken("s", publicImageToken("s", { path: "previews/a.jpg", width: 4000 }))).toBeNull();
  });

  it("the file name says what it is", () => {
    expect(logoFileName("MyAdvocate")).toBe("myadvocate-logo");
    expect(logoFileName("Be Healthy BD!")).toBe("be-healthy-bd-logo");
    expect(logoFileName("রহিম টি")).toBe("logo");
    expect(publicImagePath("s", "previews/a.jpg", 640, "Rahim Tea")).toMatch(/^\/logo\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\/rahim-tea-logo\.webp$/);
  });

  it("only the pictures a caller marks public get these addresses", async () => {
    const { getFileStorage } = await import("@/lib/storage");
    const got = await getFileStorage().createReadUrls("entry-files", ["previews/a.jpg", "previews/b.jpg"], 3600, { width: 640, publicBrands: new Map([["previews/a.jpg", "Rahim Tea"]]) });
    expect(got.get("previews/a.jpg")).toMatch(/^https:\/\/logocontest\.bd\/logo\/.+\/rahim-tea-logo\.webp$/);
    expect(got.get("previews/b.jpg")).toContain("/api/img/");
  });

  it("serves a public design; a private, NDA, blind, hidden, rejected or deleted one is not found", async () => {
    const { GET } = await import("@/app/logo/[token]/[name]/route");
    st.file = new Uint8Array(await sharp({ create: { width: 800, height: 800, channels: 3, background: "#8b0000" } }).jpeg().toBuffer());
    const token = publicImageToken("test-secret", { path: "previews/a.jpg", width: 640 });
    const load = () => GET(new Request("https://x"), { params: Promise.resolve({ token, name: "rahim-tea-logo.webp" }) });
    const ok = await load();
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/webp");
    expect(ok.headers.get("cache-control")).toContain("s-maxage=86400");
    for (const change of [{ is_private: true }, { is_nda: true }, { is_blind: true, winner_is_public: false }, { deleted_at: "2026-11-01" }, { status: "draft" }]) {
      st.entry = { status: "winner", is_hidden: false, contest: { ...contest, ...change } };
      expect((await load()).status).toBe(404);
    }
    st.entry = { status: "rejected", is_hidden: false, contest };
    expect((await load()).status).toBe(404);
    st.entry = { status: "active", is_hidden: true, contest: { ...contest, status: "open" } };
    expect((await load()).status).toBe(404);
    st.entry = null;
    expect((await load()).status).toBe(404);
    expect((await GET(new Request("https://x"), { params: Promise.resolve({ token: "bad.token", name: "x.webp" }) })).status).toBe(404);
  });
});

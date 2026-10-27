import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-10-27: "the site is very slow" and Supabase sent 1.24 GB in a day (Storage 805 MB, API 410 MB). Design
// pictures got a new signed link on every page render (so they downloaded again every time), a star click redrew the
// page twice, comments waited for their email, and the settings table was downloaded on every request.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const sign = vi.hoisted(() => ({ calls: [] as { bucket: string; paths: string[]; seconds: number }[], fail: false, missing: new Set<string>(), n: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        createSignedUrls: async (paths: string[], seconds: number) => {
          sign.calls.push({ bucket, paths, seconds });
          await new Promise((r) => setTimeout(r, 1));
          if (sign.fail) return { data: null, error: { message: "down" } };
          sign.n++;
          return { data: paths.map((p) => ({ path: p, signedUrl: sign.missing.has(p) ? null : `https://x/${bucket}/${p}?token=${sign.n}` })), error: null };
        },
      }),
    },
  }),
}));

let k = 0;
const fresh = () => `f${++k}.jpg`;

beforeEach(() => {
  sign.calls = [];
  sign.fail = false;
  sign.missing = new Set();
});
afterEach(() => vi.useRealTimers());

describe("signed picture links are reused", () => {
  it("the same design pictures get the same link on the next render, so the browser and CDN keep them", async () => {
    const { getFileStorage } = await import("@/lib/storage");
    const [a, b] = [fresh(), fresh()];
    const one = await getFileStorage().createReadUrls("entry-files", [a, b], 3600);
    const two = await getFileStorage().createReadUrls("entry-files", [b, a, b], 3600);
    expect(sign.calls).toHaveLength(1);
    expect(sign.calls[0].seconds).toBe(7200);
    expect(two.get(a)).toBe(one.get(a));
    expect(two.get(b)).toBe(one.get(b));
    // Only the new picture is signed next time.
    const c = fresh();
    await getFileStorage().createReadUrls("entry-files", [a, c], 3600);
    expect(sign.calls[1].paths).toEqual([c]);
  });

  it("a link is handed out again only while it still lasts as long as asked", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { getFileStorage } = await import("@/lib/storage");
    const a = fresh();
    const first = await getFileStorage().createReadUrls("contest-files", [a], 3600);
    vi.setSystemTime(Date.now() + 50 * 60_000);
    expect((await getFileStorage().createReadUrls("contest-files", [a], 3600)).get(a)).toBe(first.get(a));
    vi.setSystemTime(Date.now() + 20 * 60_000);
    const later = await getFileStorage().createReadUrls("contest-files", [a], 3600);
    expect(later.get(a)).not.toBe(first.get(a));
    expect(sign.calls).toHaveLength(2);
  });

  it("parallel renders share one signing", async () => {
    const { getFileStorage } = await import("@/lib/storage");
    const a = fresh();
    const [x, y] = await Promise.all([getFileStorage().createReadUrls("pro-files", [a], 3600), getFileStorage().createReadUrls("pro-files", [a], 3600)]);
    expect(sign.calls).toHaveLength(1);
    expect(x.get(a)).toBe(y.get(a));
  });

  it("payment proofs, ID photos, claims and handover files always get a fresh short link", async () => {
    const { getFileStorage } = await import("@/lib/storage");
    const a = fresh();
    for (const bucket of ["payment-proofs", "id-documents", "claim-files", "handover-files"]) {
      await getFileStorage().createReadUrls(bucket, [a], 600);
      await getFileStorage().createReadUrls(bucket, [a], 600);
    }
    expect(sign.calls).toHaveLength(8);
    expect(sign.calls.every((c) => c.seconds === 600)).toBe(true);
  });

  it("a missing file or a failed signing is not kept: the next render asks again", async () => {
    const { getFileStorage } = await import("@/lib/storage");
    const [a, gone] = [fresh(), fresh()];
    sign.missing.add(gone);
    const got = await getFileStorage().createReadUrls("entry-files", [a, gone], 3600);
    expect(got.has(gone)).toBe(false);
    sign.missing.clear();
    await new Promise((r) => setTimeout(r, 5));
    expect((await getFileStorage().createReadUrls("entry-files", [gone], 3600)).has(gone)).toBe(true);

    const b = fresh();
    sign.fail = true;
    await expect(getFileStorage().createReadUrls("entry-files", [b], 3600)).rejects.toThrow("down");
    sign.fail = false;
    await new Promise((r) => setTimeout(r, 5));
    expect((await getFileStorage().createReadUrls("entry-files", [b], 3600)).has(b)).toBe(true);
  });
});

describe("wiring", () => {
  it("a star, heart or hide click redraws the page once (the server action's refresh), and never waits for emails", () => {
    expect(read("src/components/client/review-buttons.tsx")).not.toContain("router.refresh()");
    expect(read("src/components/entries/hidden-bits.tsx")).not.toContain("router.refresh()");
    const review = read("src/lib/entries/review-actions.ts");
    expect(review).toContain("if (rating) after(() => notify(");
    expect(review).toContain("if (on) after(() => emailShortlisted(entryId));");
    expect(read("src/lib/entries/actions.ts")).toContain("after(async () => {\n    if (user.id === c.client_id) {");
    expect(read("src/lib/contests/community-actions.ts")).toContain("after(async () => notify([contest.ownerId");
  });

  it("settings and services are kept across requests and cleared by every write", () => {
    const settings = read("src/lib/settings/index.ts");
    expect(settings).toContain('{ tags: [SETTINGS_TAG], revalidate: 300 }');
    expect(read("src/lib/services/store.ts")).toContain("{ tags: [SERVICES_TAG], revalidate: 300 }");
    expect(read("src/lib/services/admin-actions.ts").match(/updateTag\(SERVICES_TAG\);/g)?.length).toBe(3);
    // Every file that writes the settings table clears the cache.
    const writers = ["src/lib/admin/site-actions.ts", "src/lib/admin/unpaid-alert-actions.ts", "src/lib/agreements/admin-actions.ts", "src/lib/cards/actions.ts", "src/lib/content/picture-actions.ts", "src/lib/home/hero-actions.ts", "src/lib/home/how-video-actions.ts", "src/lib/legal/admin-actions-legal.ts", "src/lib/notifications/admin-actions.ts", "src/lib/onboarding/actions.ts", "src/lib/pinterest/actions.ts", "src/lib/rewards/month-actions.ts", "src/lib/wallet/actions.ts", "src/lib/domain/watch.ts"];
    for (const f of writers) expect(read(f), f).toContain("settingsChanged();");
    const all = execSync(`grep -rlE 'from\\("settings"\\)[^;]*\\.(upsert|update|insert|delete)|\\.from\\("settings"\\)\\s*$' src || true`, { encoding: "utf8" }).split("\n").filter(Boolean);
    for (const f of all) if (f !== "src/lib/settings/index.ts") expect(writers, `${f} writes settings`).toContain(f);
  });

  it("the contest page loads the contest once and the designs only on the Designs tab", () => {
    expect(read("src/lib/contests/browse.ts")).toContain("export const getContestBySlug = cache(loadContestBySlug);");
    expect(read("src/app/contest/[slug]/page.tsx")).toContain('!blindHidden && tab === "entries" ? listEntries(contest.id, entryContest, user, sort) : [],');
  });

  it("pages refresh only while someone looks at them; the Unpaid page once a minute", () => {
    expect(read("src/components/admin/auto-refresh.tsx")).toContain('if (document.visibilityState !== "visible" || !document.hasFocus()) return void (missed = true);');
    expect(read("src/app/admin/unpaid/page.tsx")).toContain("<AutoRefresh seconds={60} />");
    expect(read("src/app/admin/support/page.tsx")).toContain("<AutoRefresh seconds={20} />");
    for (const f of ["src/components/client/chat.tsx", "src/components/pro/chat-thread.tsx"]) expect(read(f)).toContain("!document.hasFocus()");
  });

  it("visitors don't download the admin panel's texts, nor the Bangla font on English pages", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('messages={user?.role === "admin" ? messages : withoutAdminTexts(messages)}');
    expect(layout).toMatch(/Hind_Siliguri\(\{[\s\S]*preload: false,[\s\S]*\}\);/);
    expect(read("src/components/ui/avatar.tsx")).toContain('loading="lazy"');
  });
});

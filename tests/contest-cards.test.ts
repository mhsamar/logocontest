import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoPostTime,
  cardBrand,
  cardEligibility,
  cleanHashtags,
  cleanText,
  DEFAULT_CAPTION,
  fillCaption,
  MAX_ATTEMPTS,
  nameSize,
  nextDhakaTime,
  pickStyle,
  prizeText,
  retryDue,
  SHORT_LINK,
  shortLinkText,
} from "@/lib/cards/rules";
import { cardMarkup, type CardData } from "@/lib/cards/template";
import { crc32, zipFiles } from "@/lib/cards/zip";

vi.mock("server-only", () => ({}));

// Contest cards + Facebook posts (owner, 2026-10-19; Design/contest-cards).
const NOW = new Date("2026-10-19T06:00:00Z"); // 12:00 in Dhaka
const live = { status: "open", isPrivate: false, isNda: false, shareOnFacebook: true, endsAt: new Date("2026-10-26T18:00:00Z") };

describe("which contests get a card", () => {
  it("only live (paid, open) public contests whose client left the switch on", () => {
    expect(cardEligibility(live, NOW)).toBe("ok");
    for (const status of ["draft", "pending_payment", "cancelled", "judging", "completed", "deleted"]) expect(cardEligibility({ ...live, status }, NOW)).toBe("not_live");
    expect(cardEligibility({ ...live, endsAt: new Date("2026-10-18T00:00:00Z") }, NOW)).toBe("not_live");
  });
  it("never private, NDA, or when the client said no", () => {
    expect(cardEligibility({ ...live, isPrivate: true }, NOW)).toBe("private");
    expect(cardEligibility({ ...live, isNda: true }, NOW)).toBe("private");
    expect(cardEligibility({ ...live, shareOnFacebook: false }, NOW)).toBe("client_off");
  });
});

describe("card style", () => {
  it("Big prize from the admin's amount; otherwise Maroon night and Clean light in turn", () => {
    expect(pickStyle({ prize: 20000, bigFrom: 20000, setting: "auto", lastTurn: "maroon" })).toBe("big");
    expect(pickStyle({ prize: 19999, bigFrom: 20000, setting: "auto", lastTurn: "maroon" })).toBe("light");
    expect(pickStyle({ prize: 5000, bigFrom: 20000, setting: "auto", lastTurn: "light" })).toBe("maroon");
    expect(pickStyle({ prize: 5000, bigFrom: 20000, setting: "auto", lastTurn: null })).toBe("maroon");
    expect(pickStyle({ prize: 50000, bigFrom: 20000, setting: "light", lastTurn: null })).toBe("light");
    expect(pickStyle({ prize: 25000, bigFrom: 30000, setting: "auto", lastTurn: "light" })).toBe("maroon");
  });
});

describe("caption and card text", () => {
  const vars = { brand_name: "Walima", category: "Matrimony website", prize: prizeText(15000), days_left: "7", end_date: "26 Oct", contest_link: "https://logocontest.bd/c/LC-0012", hashtags: "#logocontest #logodesign" };
  it("fills every variable of the default template", () => {
    const c = fillCaption(DEFAULT_CAPTION, vars);
    expect(c).toContain("Walima (Matrimony website)");
    expect(c).toContain("৳15,000");
    expect(c).toContain("7 days left (ends 26 Oct)");
    expect(c).toContain("https://logocontest.bd/c/LC-0012");
    expect(c).toContain("#logocontest #logodesign");
    expect(c).not.toMatch(/\{\{/);
  });
  it("text from a contest can't bring in other variables, line breaks or control characters", () => {
    const brand = cleanText("Evil {{contest_link}}\n‮Brand\u0007");
    expect(brand).toBe("Evil contest_link Brand");
    expect(fillCaption("{{brand_name}} {{prize}}", { ...vars, brand_name: "{{prize}}" })).toBe("{{prize}} 15,000");
    expect(fillCaption("{{unknown}} {{brand_name}}", vars)).toBe("{{unknown}} Walima");
  });
  it("the card escapes HTML, and never shows the client's own details", () => {
    const d: CardData = { brand: `<script>alert(1)</script>"Café"`, kicker: "Logo design · Food", lineBn: "নতুন লোগো চাই", words: ["Modern"], colors: ["#8B0000", "red;background:url(x)"], prize: 12345, daysLeft: 1, endText: "20 Oct", code: "LC-0099", link: shortLinkText(99), last24: true };
    const html = cardMarkup(d, "maroon", "1080x1350");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("৳12,345");
    expect(html).toContain("1 day left");
    expect(html).toContain("Last 24 hours");
    expect(html).toContain("logocontest.bd/c/LC-0099");
    // Only real hex colours become dots.
    expect(html).toContain("background: #8B0000");
    expect(html).not.toContain("url(x)");
    // The card reads only contest columns: no client, profile, phone, email or payment fields.
    const src = readFileSync("src/lib/cards/store.ts", "utf8");
    const reads = [...src.matchAll(/(?:CONTEST_COLUMNS = |\.select\()"([^"]+)"/g)].map((m) => m[1]).join(" ");
    expect(reads).toContain("brand_name");
    expect(reads).not.toMatch(/client_id|profiles|mobile|email|avatar|payment|amount_paid|total_amount/);
  });
  it("long brand names shrink and stop at 40 letters", () => {
    expect(nameSize("Walima")).toBe("");
    expect(nameSize("Find Travel Partner")).toBe("lg");
    expect(nameSize("Bangladesh Agro Processing & Export Co")).toBe("xl");
    expect(cardBrand("Bangladesh Agro Processing & Export Company Limited").length).toBeLessThanOrEqual(40);
    expect(cardBrand("Bangladesh Agro Processing & Export Company Limited").endsWith("…")).toBe(true);
  });
  it("prize is the real amount, never rounded", () => {
    expect(prizeText(15000)).toBe("15,000");
    expect(prizeText(12345)).toBe("12,345");
    expect(prizeText(150000)).toBe("1,50,000");
  });
  it("hashtags are cleaned", () => {
    expect(cleanHashtags(["logocontest", "#logo design", "##bangladesh", "#logocontest", ""])).toEqual(["#logocontest", "#logodesign", "#bangladesh"]);
  });
});

describe("the card on the server", () => {
  it("every text falls back to Hind Siliguri, so ৳ and Bangla draw on a server without Bangla fonts", async () => {
    const { CARD_CSS } = await import("@/lib/cards/card-css");
    expect(CARD_CSS).not.toMatch(/'Urbanist',sans-serif/);
    expect(CARD_CSS).toContain("font-family:Urbanist,'Hind Siliguri',sans-serif");
    const { cardPage, CARD_TEMPLATE_VERSION } = await import("@/lib/cards/template");
    expect(CARD_TEMPLATE_VERSION).toBeGreaterThanOrEqual(2);
    const html = cardPage({ brand: "X", kicker: "Logo design", lineBn: "", words: [], colors: [], prize: 5000, daysLeft: 2, endText: "21 Oct", code: "LC-0008", link: "logocontest.bd/c/LC-0008", last24: false }, "light", "1080x1350");
    expect(html).toContain("family=Hind+Siliguri");
    expect(html).toContain("family=JetBrains+Mono");
  });
  it("cards drawn with an older look, or missing a picture, are drawn again before posting", () => {
    const job = readFileSync("src/lib/cards/job.ts", "utf8");
    expect(job).toMatch(/images\.t \?\? 1\) >= CARD_TEMPLATE_VERSION/);
    expect(readFileSync("src/lib/cards/store.ts", "utf8")).toContain("t: CARD_TEMPLATE_VERSION");
  });
});

describe("when posts go out, and retries", () => {
  it("right away, best window (8–10 pm Dhaka) or the custom time", () => {
    expect(autoPostTime("now", "20:30", NOW)).toBeNull();
    expect(autoPostTime("best", "20:30", NOW)?.toISOString()).toBe("2026-10-19T14:30:00.000Z");
    expect(autoPostTime("best", "20:30", new Date("2026-10-19T14:40:00Z"))).toBeNull();
    expect(autoPostTime("custom", "09:15", NOW)?.toISOString()).toBe("2026-10-20T03:15:00.000Z");
    expect(nextDhakaTime("12:05", NOW).toISOString()).toBe("2026-10-20T06:05:00.000Z");
  });
  it("a failed post is tried 3 times, waiting 15, 30, 60 minutes, then stays Failed", () => {
    const at = (min: number) => new Date(NOW.getTime() - min * 60_000);
    expect(retryDue(1, at(10), NOW)).toBe(false);
    expect(retryDue(1, at(16), NOW)).toBe(true);
    expect(retryDue(2, at(20), NOW)).toBe(false);
    expect(retryDue(2, at(31), NOW)).toBe(true);
    expect(retryDue(MAX_ATTEMPTS, at(9999), NOW)).toBe(false);
  });
  it("the short link /c/LC-0012 is recognised; usernames are not", () => {
    expect(SHORT_LINK.exec("/c/LC-0012")?.[1]).toBe("0012");
    expect(SHORT_LINK.exec("/c/lc12")?.[1]).toBe("12");
    expect(SHORT_LINK.exec("/c/anika009")).toBeNull();
  });
});

describe("All sizes (.zip)", () => {
  it("is a valid zip with the right checksums", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
    const zip = zipFiles([{ name: "a.png", data: new Uint8Array([1, 2, 3]) }, { name: "b.png", data: new Uint8Array([4]) }]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(zip.length - 22 + 10, true)).toBe(2);
  });
});

// ---- Facebook posting and the one-card-per-contest rule, with Facebook, the database and the renderer mocked ----

const store = vi.hoisted(() => ({
  insertError: null as null | { code: string; message: string },
  updates: [] as Record<string, unknown>[],
  drawn: 0,
  contest: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/settings", () => ({
  getSettings: async () => ({ "cards.style": "auto", "cards.big_prize_from": 20000, "cards.auto_post": true, "cards.check_first": true, "cards.last24": false, "cards.post_when": "now", "cards.custom_time": "20:30" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        in: () => q,
        order: () => q,
        limit: async () => ({ data: [] }),
        insert: (values: Record<string, unknown>) => ({ select: () => ({ single: async () => (store.insertError ? { data: null, error: store.insertError } : { data: { id: "11111111-1111-4111-8111-111111111111", attempts: 0, images: {}, ...values }, error: null }) }) }),
      };
      return q;
    },
  }),
}));
vi.mock("@/lib/cards/store", () => ({
  cardsReady: async () => ({ table: true, shareColumn: true }),
  CONTEST_COLUMNS: "",
  contestForCard: async () => store.contest,
  drawCard: async () => {
    store.drawn++;
    return { v: 1, "1080x1350": "c1/new-maroon-1080x1350.png" };
  },
  imageUrl: (images: Record<string, string>, size: string) => (images[size] ? `https://x.supabase.co/storage/v1/object/public/contest-cards/${images[size]}` : null),
  makeCaption: async () => "caption",
  updateCard: async (_id: string, patch: Record<string, unknown>) => void store.updates.push(patch),
}));

const contestRow = { id: "c1", slug: "walima", contest_number: 12, brand_name: "Walima", business_type: "services", business_type_other: null, service: "logo", styles: [], style_sliders: {}, colors: [], prize_amount: 15000, ends_at: "2026-10-26T18:00:00Z", starts_at: "2026-10-19T00:00:00Z", status: "open", is_private: false, is_nda: false, share_on_facebook: true };

describe("one card per contest", () => {
  beforeEach(() => {
    store.insertError = null;
    store.updates = [];
    store.drawn = 0;
  });
  it("draws the card once; a second run finds the row taken and makes nothing", async () => {
    const { createCard } = await import("@/lib/cards/job");
    const first = await createCard(contestRow, "new", NOW);
    expect(first?.status).toBe("waiting");
    expect(store.drawn).toBe(1);
    store.insertError = { code: "23505", message: "duplicate key value violates unique constraint" };
    expect(await createCard(contestRow, "new", NOW)).toBeNull();
    expect(store.drawn).toBe(1);
  });
  it("a private contest gets a skipped row and no picture", async () => {
    const { createCard } = await import("@/lib/cards/job");
    const card = await createCard({ ...contestRow, is_private: true }, "new", NOW);
    expect(card?.status).toBe("skipped");
    expect(store.drawn).toBe(0);
  });
});

describe("Facebook posting (mocked)", () => {
  beforeEach(() => {
    vi.stubEnv("FACEBOOK_PAGE_ID", "1234567890");
    vi.stubEnv("FACEBOOK_PAGE_TOKEN", "EAAB-secret-token");
    store.updates = [];
    store.contest = contestRow;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts the 4:5 card as a photo with the caption; the token goes in the body, never the URL", async () => {
    const calls: { url: string; body: string }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return new Response(JSON.stringify({ id: "999", post_id: "1234567890_555" }), { status: 200 });
    }) as unknown as typeof fetch;
    const { postPhoto } = await import("@/lib/cards/facebook");
    const post = await postPhoto({ imageUrl: "https://x/card.png", caption: "Hello" }, fake);
    expect(post).toEqual({ postId: "1234567890_555", url: "https://www.facebook.com/1234567890/posts/555" });
    expect(calls[0].url).toMatch(/graph\.facebook\.com\/v\d+\.0\/1234567890\/photos$/);
    expect(calls[0].url).not.toContain("secret");
    const body = new URLSearchParams(calls[0].body);
    expect(body.get("url")).toBe("https://x/card.png");
    expect(body.get("caption")).toBe("Hello");
    expect(body.get("access_token")).toBe("EAAB-secret-token");
  });

  it("scheduling uses Facebook's scheduled publish", async () => {
    let sent = "";
    const fake = (async (_u: string, init: RequestInit) => ((sent = String(init.body)), new Response(JSON.stringify({ id: "777" }), { status: 200 }))) as unknown as typeof fetch;
    const { postPhoto } = await import("@/lib/cards/facebook");
    const at = new Date("2026-10-19T14:30:00Z");
    const post = await postPhoto({ imageUrl: "https://x/card.png", caption: "Hi", at }, fake);
    const body = new URLSearchParams(sent);
    expect(body.get("published")).toBe("false");
    expect(body.get("scheduled_publish_time")).toBe(String(at.getTime() / 1000));
    expect(post.url).toBe("https://www.facebook.com/photo/?fbid=777");
  });

  it("success: the card is Posted with the post link", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ id: "1", post_id: "1234567890_42" }), { status: 200 }));
    const { postCard } = await import("@/lib/cards/job");
    const out = await postCard({ id: "k", contest_id: "c1", kind: "new", style: "maroon", line_bn: null, images: { "1080x1350": "p.png" }, caption: "Hi", status: "waiting", skip_reason: null, fb_post_id: null, fb_post_url: null, scheduled_at: null, posted_at: null, posted_by: null, error: null, attempts: 0, tried_at: null, created_at: "", updated_at: "" }, {}, NOW);
    expect(out.status).toBe("posted");
    expect(out.fb_post_url).toBe("https://www.facebook.com/1234567890/posts/42");
  });

  it("failure → tried again → after 3 tries it stays Failed; a missing permission stops at once", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "Temporary problem", code: 2 } }), { status: 500 }));
    const { postCard } = await import("@/lib/cards/job");
    let card = { id: "k", contest_id: "c1", kind: "new" as const, style: "maroon" as const, line_bn: null, images: { "1080x1350": "p.png" }, caption: "Hi", status: "waiting" as const, skip_reason: null, fb_post_id: null, fb_post_url: null, scheduled_at: null, posted_at: null, posted_by: null, error: null, attempts: 0, tried_at: null, created_at: "", updated_at: "" } as Parameters<typeof postCard>[0];
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      card = await postCard(card, {}, NOW);
      expect(card.status).toBe("failed");
      expect(card.attempts).toBe(i);
    }
    expect(retryDue(card.attempts, NOW, new Date(NOW.getTime() + 86_400_000))).toBe(false);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "(#200) Requires pages_manage_posts permission", code: 200 } }), { status: 403 }));
    const denied = await postCard({ ...card, attempts: 0 }, {}, NOW);
    expect(denied.status).toBe("failed");
    expect(denied.attempts).toBe(MAX_ATTEMPTS);
    expect(denied.error).toMatch(/^PERMISSION /);
    expect(denied.error).not.toContain("EAAB-secret-token");
  });

  it("a contest that turned private is skipped, not posted", async () => {
    store.contest = { ...contestRow, is_private: true };
    const { postCard } = await import("@/lib/cards/job");
    const out = await postCard({ id: "k", contest_id: "c1", kind: "new", style: "maroon", line_bn: null, images: { "1080x1350": "p.png" }, caption: "Hi", status: "waiting", skip_reason: null, fb_post_id: null, fb_post_url: null, scheduled_at: null, posted_at: null, posted_by: null, error: null, attempts: 0, tried_at: null, created_at: "", updated_at: "" }, {}, NOW);
    expect(out.status).toBe("skipped");
  });
});

describe("admin access: Auto share roles (same as Admin › Pinterest)", () => {
  it("page, actions and downloads check Auto share permissions; the menu item sits with Pinterest", () => {
    expect(readFileSync("src/app/admin/contest-cards/page.tsx", "utf8")).toContain('requirePermission("autoshare.view")');
    const actions = readFileSync("src/lib/cards/actions.ts", "utf8");
    expect(actions).toContain('adminUser("autoshare.manage")');
    for (const fn of ["postCardNow", "scheduleCard", "skipCard", "remakeCard", "saveCardCaption", "saveCardSettings", "saveCaptionTemplate", "saveHashtags"]) expect(actions).toMatch(new RegExp(`export async function ${fn}\\(`));
    expect(readFileSync("src/app/api/contest-cards/[id]/[file]/route.ts", "utf8")).toContain('adminUser("autoshare.view")');
    const nav = readFileSync("src/lib/admin/nav.ts", "utf8");
    expect(nav).toMatch(/\/admin\/pinterest".*perm: "autoshare\.view"[\s\S]*\/admin\/contest-cards".*perm: "autoshare\.view"/);
    // Every admin action is in the audit log.
    expect(actions.match(/await audit\(/g)?.length).toBeGreaterThanOrEqual(9);
  });
  it("the token stays on the server", () => {
    const fb = readFileSync("src/lib/cards/facebook.ts", "utf8");
    expect(fb).toContain('import "server-only"');
    for (const f of ["src/components/admin/contest-cards-bits.tsx", "src/components/wizard/share-facebook.tsx"]) expect(readFileSync(f, "utf8")).not.toMatch(/FACEBOOK_PAGE_TOKEN|access_token/);
  });
});

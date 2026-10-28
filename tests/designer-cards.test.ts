import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// Owner, 2026-10-27: "image er quality valo rakhay size always compresed korba". Win, monthly and payment cards were
// ~1 MB PNGs shown straight from Supabase; they are now kept as JPEG and pages show a small WebP the CDN keeps.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

vi.mock("server-only", () => ({}));

describe("designer cards are lighter", () => {
  it("a drawn card is kept as a good JPEG and shown as a small WebP", async () => {
    const { cardJpeg, cardWebp, cardViewWidth, cardThumb } = await import("@/lib/rewards/card-picture");
    // A busy picture, like a real card (a flat colour would make any format tiny).
    const png = new Uint8Array(await sharp({ create: { width: 1080, height: 1080, channels: 3, background: "#8b0000", noise: { type: "gaussian", mean: 128, sigma: 20 } } }).png().toBuffer());
    const jpg = await cardJpeg(png);
    expect((await sharp(jpg).metadata()).format).toBe("jpeg");
    expect((await sharp(jpg).metadata()).width).toBe(1080);
    expect(jpg.length).toBeLessThan(png.length);
    const small = await cardWebp(jpg, 640);
    expect((await sharp(small).metadata()).format).toBe("webp");
    expect((await sharp(small).metadata()).width).toBe(640);
    expect(small.length).toBeLessThan(jpg.length);
    expect([cardViewWidth("640"), cardViewWidth("320"), cardViewWidth("1080"), cardViewWidth(null)]).toEqual([640, 320, null, null]);
    expect([cardThumb("/api/cards/win/a/square", "square"), cardThumb("/api/cards/win/a/story", "story")]).toEqual(["/api/cards/win/a/square?w=640", "/api/cards/win/a/story?w=320"]);
  });

  it("win and monthly cards are stored as JPEG; pages show the small copies, sharing keeps the full pictures", () => {
    expect(read("src/lib/rewards/win-cards.ts")).toContain('const path = `win/${card.id}-${size}.jpg`;\n  await getFileStorage().upload(REWARD_CARDS_BUCKET, path, jpg, "image/jpeg");');
    expect(read("src/lib/rewards/month-close.ts")).toContain('const path = `monthly/${reward.id}-${size}.jpg`;\n  await getFileStorage().upload(REWARD_CARDS_BUCKET, path, jpg, "image/jpeg");');
    expect(read("src/app/dashboard/page.tsx")).toContain('image: winCardThumb(c.slug, "square")');
    const mine = read("src/app/dashboard/wins/[slug]/page.tsx");
    expect(mine).toContain('<img src={winCardThumb(card.slug, "square")}');
    expect(mine).toContain('<img src={winCardThumb(card.slug, "story")}');
    expect(mine).toContain("images={{ square, story }}");
    const pub = read("src/app/wins/[slug]/page.tsx");
    expect(pub).toContain('<img src={winCardThumb(card.slug, "square")}');
    expect(pub).toContain('const src = winCardImage(slug, "square", path);');
    expect(read("src/lib/rewards/claims.ts")).toContain('thumb: monthlyCardThumb(id, "square"),');
    expect(read("src/components/rewards/prize-banner.tsx")).toContain("<img src={r.thumb}");
    expect(read("src/components/rewards/reward-claim.tsx")).toContain("<img src={p.thumb}");
    expect(read("src/app/dashboard/rewards/[id]/page.tsx")).toContain("<img src={reward.thumb}");
    // Downloads and the phone's share sheet name the file by what it is.
    expect(read("src/components/rewards/win-card-share.tsx")).toContain('`${fileName}-${size}.${type === "image/png" ? "png" : "jpg"}`');
  });

  it("the routes send the small copy for ?w= (kept by the CDN once public) and payment cards as WebP or a JPEG download", () => {
    const win = read("src/app/api/cards/win/[slug]/[size]/route.ts");
    expect(win).toContain("if (path && !width) return NextResponse.redirect(cardPictureUrl(path), { status: 302 });");
    expect(win).toContain('"Content-Type": "image/webp", "Cache-Control": "public, max-age=86400, s-maxage=604800"');
    const monthly = read("src/app/api/cards/monthly/[id]/[size]/route.ts");
    expect(monthly).toContain('const keep = reward.sentAt ? "public, max-age=86400, s-maxage=604800" : "private, max-age=300";');
    const payout = read("src/app/api/cards/payout/[id]/[size]/route.ts");
    expect(payout).toContain("const picture = download ? await cardJpeg(png) : await cardWebp(png, 640);");
    expect(payout).toContain('filename="logocontest-payment-${size}.jpg"');
    expect(payout).toContain('"Cache-Control": "private, max-age=604800"');
  });
});

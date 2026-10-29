import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Translate } from "@/lib/i18n/translate";

// Small design fixes on Start a contest, Browse contests and How it works (owner, 2026-10-29; Design/logocontest-site):
// the text, routes and data rules stay as they are, only the looks change.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/seo/facts", () => ({ siteFacts: async () => ({ minPrize: 2000 }) }));
vi.mock("@/lib/services/store", () => ({ allServices: async () => [] }));
vi.mock("@/lib/i18n/server", () => ({ getI18n: async () => ({}) }));

const { cardMinPrize } = await import("@/components/services/design-types");
const { BrandTile, PackagePill, TILE_PASTELS, tilePastel } = await import("@/components/contests/contest-bits");

const t = ((key: string) => key) as Translate;
const read = (f: string) => readFileSync(f, "utf8");
const ids = Array.from({ length: 200 }, (_, i) => `${(i * 2654435761).toString(16).padStart(8, "0")}-4b1d-4c3a-9e2f-${String(i).padStart(12, "0")}`);

describe("Browse cards: pastel letter tiles", () => {
  it("picks the same pastel for a contest every time", () => {
    for (const id of ids) expect(tilePastel(id)).toBe(tilePastel(id));
  });
  it("always picks one of the design's pastels, and uses all of them", () => {
    const used = new Set(ids.map(tilePastel));
    for (const c of used) expect(TILE_PASTELS).toContain(c);
    expect(used.size).toBe(TILE_PASTELS.length);
    expect(TILE_PASTELS).toHaveLength(4);
    expect(TILE_PASTELS[0]).toBe("bg-[#F4EFE4] text-[#7A1E12]");
    expect(TILE_PASTELS).not.toContain("bg-[#111216] text-[#FFFFFF]");
  });
  it("is opt-in: other pages keep the sand tile; a lock or a design picture ignores it", () => {
    const html = (props: Parameters<typeof BrandTile>[0]) => renderToStaticMarkup(createElement(BrandTile, props));
    const id = ids.find((x) => tilePastel(x) !== TILE_PASTELS[0])!;
    expect(html({ name: "Nodi Tea", isPrivate: false, pastel: id })).toContain(tilePastel(id));
    expect(html({ name: "Nodi Tea", isPrivate: false })).toContain(TILE_PASTELS[0]);
    expect(html({ name: "Nodi Tea", isPrivate: false, pastel: "" })).toContain(TILE_PASTELS[0]);
    const locked = html({ name: "", isPrivate: true, pastel: id });
    expect(locked).toContain("gradient-red-dark");
    expect(locked).not.toContain(tilePastel(id));
    expect(html({ name: "Nodi Tea", isPrivate: false, cover: { url: "/x.png", isWinner: false }, pastel: id })).not.toContain(tilePastel(id));
  });
  it("only the browse cards ask for it", () => {
    const cards = read("src/components/contests/browse-cards.tsx");
    expect(cards.match(/pastel=\{c\.id\}/g)).toHaveLength(2);
    for (const f of ["src/components/contests/contest-row.tsx", "src/components/contests/contest-card.tsx", "src/components/dashboard/client-contest-card.tsx", "src/app/contest/[slug]/page.tsx"])
      expect(read(f)).not.toContain("pastel=");
  });
});

describe("Browse cards: round package pill", () => {
  it("keeps the old chip everywhere else and takes the browse shape when given", () => {
    const plain = renderToStaticMarkup(createElement(PackagePill, { pkg: "elite", t }));
    expect(plain).toContain("rounded-lg px-2.5 py-1 text-[13px]");
    expect(plain).toContain("bg-tint text-primary");
    const round = renderToStaticMarkup(createElement(PackagePill, { pkg: "elite", t, className: "rounded-full px-[9px] py-0.5 text-[12.5px]" }));
    expect(round).toContain("rounded-full px-[9px] py-0.5 text-[12.5px]");
    expect(round).not.toContain("rounded-lg");
    expect(round).toContain("bg-tint text-primary");
  });
  it("both browse cards pass the badge shape", () => {
    expect(read("src/components/contests/browse-cards.tsx").match(/<PackagePill pkg=\{c\.package\} t=\{t\} className=\{BADGE\} \/>/g)).toHaveLength(2);
  });
});

describe("Start a contest: the logo card's prize", () => {
  const logo = { slug: "logo", minPrize: 3000 };
  it("shows the lowest logo prize from Admin › Pricing on the logo card", () => {
    expect(cardMinPrize(logo, 2000)).toBe(2000);
    expect(cardMinPrize(logo, 4500)).toBe(4500);
  });
  it("leaves every other service on its own minimum", () => {
    expect(cardMinPrize({ slug: "business_card", minPrize: 1000 }, 2000)).toBe(1000);
    expect(cardMinPrize({ slug: "flyer", minPrize: 1500 }, 800)).toBe(1500);
  });
  it("falls back to Admin › Services when pricing has no usable amount", () => {
    expect(cardMinPrize(logo, 0)).toBe(3000);
    expect(cardMinPrize(logo, Number.NaN)).toBe(3000);
  });
});

describe("Start a contest: heading", () => {
  const page = read("src/app/start/page.tsx");
  const css = read("src/components/services/design-types.css");
  it("uses the design's frame, pill, title and lead", () => {
    expect(page).toContain('className="dt-page"');
    expect(page).toContain('className="dt-sck"');
    expect(css).toMatch(/\.dt-page \{[^}]*gap: 20px;[^}]*max-width: 1384px;/);
    expect(css).toMatch(/\.dt-sck \{[^}]*font-size: 15px;[^}]*font-weight: 800;/);
    expect(css).toMatch(/\.dt-head h1 \{[^}]*font-size: 44px;[^}]*font-weight: 700;/);
    expect(css).toMatch(/@media \(max-width: 700px\) \{\s*\.dt-head h1 \{\s*font-size: 32px;/);
    expect(css).toMatch(/\.dt-head p \{[^}]*max-width: 760px;[^}]*font-size: 16px;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.dt-sck::before,\s*\.dt-sck::after \{\s*animation: none !important;/);
    // The Start button's small line may still wrap on phones.
    expect(css).toMatch(/\.dt-go2t small \{\s*white-space: normal;/);
  });
  it("keeps the old links and redirects", () => {
    for (const s of ["params.service", "params.draft", "params.step", "params.name", "awaitingApproval", "/pay/contest/", "/start-v2?draft=", 'redirect("/start-v2")', "<PageShell>"]) expect(page).toContain(s);
  });
});

describe("Browse contests", () => {
  const page = read("src/app/contests/page.tsx");
  it("shows the four add-ons in the guests' gold bar and opens a logo contest", () => {
    expect(page).toContain('{!designer && <AddonBadgeRow t={t} className="mt-0.5" />}');
    expect(page).toMatch(/<Link href="\/start\/logo"[^>]*>\s*\{t\("browse\.x\.featureMine"\)\}/);
    const cards = read("src/components/contests/browse-cards.tsx");
    for (const k of ["featured", "urgent", "highlighted", "privateNda"]) expect(cards).toContain(`  ${k}: "`);
  });
  it("puts the offer cards side by side from 521px", () => {
    const strip = read("src/components/contests/reward-strip.tsx");
    expect(strip).toContain("min-[521px]:grid-cols-2");
    expect(strip).not.toContain("min-[641px]:grid-cols-2");
  });
  it("draws its own chevron on both dropdowns", () => {
    const filters = read("src/components/contests/browse-filters.tsx");
    expect(filters).toContain("appearance-none");
    expect(filters).toContain('d="M6 9l6 6 6-6"');
    expect(filters.match(/<Chevron \/>/g)).toHaveLength(2);
  });
});

describe("How it works: the video cover", () => {
  const video = read("src/components/how/how-video.tsx");
  it("adds three sample logos from the site's own files, the front one tagged Winner", () => {
    expect(video).toContain("/examples/browse/logo-${tile.n}.jpg");
    expect(video.match(/\{ n: \d+, at: "/g)).toHaveLength(3);
    expect(video).toContain('t("home.how.art.winner")');
    expect(video).not.toContain("assets/");
  });
  it("has no fake timeline or placeholder pill", () => {
    expect(video).not.toContain("0:00");
    expect(video).not.toMatch(/not added yet/i);
  });
  it("still hides the whole card while no video is set", () => {
    expect(read("src/app/how-it-works/page.tsx")).toContain("{video.kind && (");
  });
});

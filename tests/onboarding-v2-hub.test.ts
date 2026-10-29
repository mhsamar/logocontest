import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyBrief, validateBriefStepV2, type Brief } from "@/lib/contests/brief";
import { applyDefaults, briefReadyPercent, SECTION_FIELDS, sectionsChanged, SEED } from "@/lib/onboarding/brief-defaults";

// Owner, 2026-10-29 (client-onboarding-v2-spec.md §3): after paying, the brief is four cards already filled in from the
// business type; each card is saved on its own and becomes the client's, the rest stay defaults.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const base: Brief = applyDefaults({ ...emptyBrief(), brandName: "Rahim Tea", businessType: "food" }, SEED.food, "Families nearby");

describe("the brief's parts", () => {
  it("a part counts as changed only when one of its own fields changed", () => {
    expect(sectionsChanged(base, base)).toEqual([]);
    expect(sectionsChanged(base, { ...base, slogan: "Hot tea" })).toEqual(["business"]);
    expect(sectionsChanged(base, { ...base, slogan: "  " })).toEqual([]);
    expect(sectionsChanged(base, { ...base, styles: ["mascot"] })).toEqual(["look"]);
    expect(sectionsChanged(base, { ...base, requirements: [], usedOn: ["video"] })).toEqual(["needs"]);
    // The "none yet" ticks aren't stored, so ticking one alone is no change.
    expect(sectionsChanged(base, { ...base, noLinks: false, noCompetitors: false })).toEqual([]);
    expect(sectionsChanged(base, { ...base, competitors: "Cafe X" })).toEqual(["links"]);
    expect(Object.values(SECTION_FIELDS).flat()).not.toContain("noLinks");
  });

  it("\"Brief X% ready\": the defaults fill most of it; the slogan and description are the client's", () => {
    expect(briefReadyPercent(base)).toBe(82);
    expect(briefReadyPercent({ ...base, slogan: "Hot tea", businessDescription: "A tea stall near the market, open since 1998." })).toBe(100);
    expect(briefReadyPercent({ ...base, styles: [], usedOn: [], requirements: [], targetAudience: "" })).toBeLessThan(60);
  });

  it("each card is checked on its own by the v2 rule: an empty description is fine, a short one isn't", () => {
    expect(validateBriefStepV2(3, base)).toEqual({});
    expect(validateBriefStepV2(3, { ...base, businessDescription: "short" })).toHaveProperty("businessDescription");
    expect(validateBriefStepV2(5, { ...base, styles: [], colors: [], letDesignersChoose: false })).toEqual({});
  });
});

describe("saving a part after paying", () => {
  const a = read("src/lib/onboarding/brief-actions.ts");
  it("writes only the brief's own columns, while unpaid, waiting for approval or live, for the contest's own client", () => {
    expect(a).toContain(".update({ ...briefColumns(brief), ...(extraAnswers ? { extra_answers: extraAnswers } : {}) })");
    expect(a).toContain('.in("status", [...OPEN_FOR_BRIEF])');
    expect(a).toContain('const OPEN_FOR_BRIEF = ["draft", "pending_payment", "open"] as const;');
    expect(a).toContain("if (!contest || contest.clientId !== user.id || !contest.briefCompletion)");
    // Never the status, the order or the amounts (a bKash payment may be waiting).
    const cols = read("src/lib/contests/supabase-repository.ts").split("export function briefColumns")[1].split("export function briefDetailColumns")[0];
    for (const banned of ["status", "total_amount", "prize_amount", "service_fee_amount", "package", "duration_days"]) expect(cols, banned).not.toContain(`${banned}:`);
  });

  it("a real change makes the part the client's; on a live contest designers are told", () => {
    expect(a).toContain("const completion = await markEdited(contest.id, changed ? [section] : []);");
    expect(a).toContain('if ((data[0].status as string) === "open" && changed) {');
    expect(a).toContain('notify(await contestDesignerIds(contest.id), "brief_updated"');
  });

  it("a cleared answer to one of the owner's questions is really cleared; the hub shows what was kept", () => {
    expect(a).toContain("const others = Object.fromEntries(Object.entries(contest.brief.extra ?? {}).filter(([k]) => !asked.some((q) => q.key === k)));");
    const hub = read("src/components/wizard-v2/brief-hub.tsx");
    expect(hub).toContain("setBrief(cleanBrief(draft));");
    // "None yet" is shown ticked for empty links or competitors, and Cancel forgets the last save's errors.
    expect(hub).toContain("noLinks: briefLinks(b).length === 0, noCompetitors: !b.competitors.trim()");
    expect(hub).toContain('<Button type="button" variant="ghost" onClick={close}>');
  });

  it("reference pictures can be added after paying: same uploads and limits, only while the brief can change", () => {
    expect(a).toContain("return createBriefUpload(own.contest.id, { name: String(input.name), type: String(input.type), size: Number(input.size) });");
    // A picture that finishes uploading after judging started is taken out of storage again.
    expect(a).toContain("await dropBriefUpload(input.contestId, String(input.path));");
    expect(a).toContain('if (own.contest.status === "open") {');
    const hub = read("src/components/wizard-v2/hub-photos.tsx");
    expect(hub).toContain("if (changed) await actions.changed({ contestId: props.contestId }).catch(() => null);");
    // "Finish" waits while the pictures card is open; Cancel waits while pictures are being made lighter.
    expect(read("src/components/wizard-v2/brief-hub.tsx")).toContain("disabled={open !== null || photosOpen}");
    expect(hub).toContain("disabled={busy || picking}");
    expect(read("src/app/start-v2/brief/page.tsx")).toContain('onboarding.hidden.includes("files")');
  });

  it("the page is the client's own, off unless ONBOARDING_V2, and the Pro invitations come back to it", () => {
    const page = read("src/app/start-v2/brief/page.tsx");
    expect(page).toContain("if (!onboardingV2On()) notFound();");
    expect(page).toContain("if (!contest || contest.clientId !== user.id || !contest.briefCompletion) notFound();");
    const invite = read("src/app/start/invite/page.tsx");
    expect(invite).toContain('const next = fromHub ? `/start-v2/brief?c=${draftId}` : `/start?draft=${draftId}&step=${isLogo ? "11" : "pay"}`;');
    expect(invite).toContain("{!fromHub && (");
  });
});

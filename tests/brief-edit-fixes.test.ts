import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { briefEditHref, briefOpen, HUB_FIELDS, SECTION_FIELDS } from "@/lib/onboarding/brief-defaults";

// Owner, 2026-10-30 ("brif a ami abar business details and many things delam, but seta dekhassy na … edit o kortay
// parsi na"): the hub lost an open card's typing without a word, a short description was refused, there was no way
// back after Finish, and some saved parts weren't shown.
const read = (p: string) => readFileSync(p, "utf8");

describe("Edit brief: where it goes", () => {
  const c = { id: "c1", slug: "urao-1651e0", hubOn: true };
  it("a v2 contest opens its brief page while unpaid, waiting for approval or live", () => {
    for (const status of ["draft", "pending_payment", "open"]) expect(briefEditHref({ ...c, status, v2: true })).toBe("/start-v2/brief?c=c1");
  });
  it("an older contest opens Edit details only while live; nothing once the contest has moved on", () => {
    expect(briefEditHref({ ...c, status: "open", v2: false })).toBe("/dashboard/contests/urao-1651e0/edit");
    expect(briefEditHref({ ...c, status: "pending_payment", v2: false })).toBeNull();
    for (const status of ["judging", "winner_selected", "completed", "cancelled"]) expect(briefEditHref({ ...c, status, v2: true })).toBeNull();
    // With the v2 pages switched off, a live v2 contest still has Edit details.
    expect(briefEditHref({ ...c, status: "open", v2: true, hubOn: false })).toBe("/dashboard/contests/urao-1651e0/edit");
    expect(briefOpen("pending_payment")).toBe(true);
  });
  it("the client page uses that rule for the header, the Brief tab, the Overview card and the photos link", () => {
    const page = read("src/app/client/contests/[id]/page.tsx");
    expect(page).toContain("const editHref = briefEditHref({");
    expect(page).toContain("const canEdit = editHref !== null;");
    expect(page.match(/href=\{editHref!\}/g)?.length).toBe(3);
    expect(page).toContain("<Link href={photosHref}");
    expect(page).toContain("<ContestBrief brief={contest.brief} withDescription");
  });
});

describe("the brief page after paying", () => {
  const hub = read("src/components/wizard-v2/brief-hub.tsx");
  it("one card at a time, and typing or pictures that aren't saved are never dropped without asking", () => {
    expect(hub).toContain("{open === null && (");
    // Cancel asks only for this card's typing; a save closes its card without asking.
    expect(hub).toContain("const close = () => (!cardDirty || window.confirm(unsaved)) && shut();");
    expect(hub).toMatch(/setEdited\(res\.edited\);\s*shut\(\);/);
    // Leaving the page: the tab, and any link (client menu, top bar, Invite, "Later"), the photo card's pictures too.
    expect(hub).toContain("const dirty = cardDirty || photosDirty;");
    expect(hub).toContain('window.addEventListener("beforeunload", warn);');
    expect(hub).toContain('document.addEventListener("click", onLink, true);');
    expect(hub).toContain("onDirty={setPhotosDirty}");
    expect(read("src/components/wizard-v2/hub-photos.tsx")).toContain("useEffect(() => onDirty?.(unsaved), [onDirty, unsaved]);");
  });

  it("a save that stops says so by the Save button, and Finish lands on the brief tab", () => {
    expect(hub).toContain('setError(t("wizardV2.hub.fixAbove"));');
    expect(hub).toContain("router.push(`/client/contests/${props.slug}?tab=brief`);");
  });
  it("card 1 sends and saves only the slogan, description and customers", () => {
    expect(HUB_FIELDS.business).toEqual(["slogan", "businessDescription", "targetAudience"]);
    expect(HUB_FIELDS.links).toEqual(SECTION_FIELDS.links);
    expect(read("src/lib/onboarding/brief-actions.ts")).toContain("for (const f of HUB_FIELDS[section]) {");
    expect(hub).toContain("HUB_FIELDS[s].map((f) => [f, draft[f]])");
  });
});

describe("what designers and the client see", () => {
  const brief = read("src/components/contests/contest-brief.tsx");
  it("the client's own links under one title, the description on the client's page, no feel sliders for v2", () => {
    expect(brief).toContain('t("contest.brief.ownLinks")');
    expect(brief).toContain("withDescription && brief.description.trim() && (");
    expect(brief).toContain("{!brief.v2 && (");
    expect(read("src/lib/contests/browse.ts")).toContain("v2: parseCompletion(data.brief_completion) !== null,");
  });
  it("the public summary says how many more requirements there are", () => {
    expect(read("src/app/contest/[slug]/page.tsx")).toContain('t("contest.brief.moreRequirements", { n: fmt(contest.brief.requirements.length - 4) })');
  });
});

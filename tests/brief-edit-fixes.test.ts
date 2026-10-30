import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { briefEditHref, briefOpen, HUB_FIELDS, SECTION_FIELDS } from "@/lib/onboarding/brief-defaults";

// Owner, 2026-10-30 ("brif a ami abar business details and many things delam, but seta dekhassy na … edit o kortay
// parsi na"): the hub lost an open card's typing without a word, a short description was refused, there was no way
// back after Finish, and some saved parts weren't shown.
const read = (p: string) => readFileSync(p, "utf8");

describe("Add photos and back from inviting Pro designers open the pictures step (owner, 2026-10-30)", () => {
  it("the links carry step=extras, and the brief page opens on it (after signing in too)", () => {
    expect(read("src/app/client/contests/[id]/page.tsx")).toContain("? `${editHref}&step=extras#photos` :");
    expect(read("src/app/start/invite/page.tsx")).toContain("const next = fromHub ? `/start-v2/brief?c=${draftId}&step=extras` :");
    const page = read("src/app/start-v2/brief/page.tsx");
    expect(page).toContain('const extras = params.step === "extras";');
    expect(page).toContain('initialStep={extras ? "extras" : undefined}');
    expect(page).toContain('${extras ? "&step=extras" : ""}');
    expect(read("src/components/wizard-v2/brief-hub.tsx")).toContain('useState(() => (props.initialStep === "extras" ? Math.max(0, steps.indexOf("extras")) : 0))');
  });
});

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
  it("one part per step (owner, 2026-10-30), and typing or pictures that aren't saved are never dropped without asking", () => {
    // Business, links, look and needs one at a time, then the pictures and Pro invitations together.
    expect(hub).toContain('[...BRIEF_SECTIONS, ...(props.photos || props.invites ? (["extras"] as const) : [])]');
    // Next, Back or the step bar save what changed on this step first; unchanged parts stay defaults.
    expect(hub).toContain("const go = (to: number) => (open && cardDirty ? save(open, (kept) => show(to, kept)) : show(to, brief));");
    expect(hub).toContain("const finish = () => (open && cardDirty ? save(open, accept) : start(accept));");
    // A "none yet" tick that takes away saved links or competitors is a change (it is saved on Next).
    expect(hub).toContain('const tickClears = open === "links" && ((draft.noLinks && briefLinks(brief).length > 0) || (draft.noCompetitors && brief.competitors.trim() !== ""));');
    // Nothing can be typed while a step saves; a lost connection stays on the step with what was typed.
    expect(hub).toContain("<fieldset disabled={busy}");
    expect(hub).toContain('if (!res) return setError(t("wizardV2.hub.offline"));');
    // The photo card stays mounted (hidden on other steps), so its saved pictures are still there after Back.
    expect(hub).toContain('<div hidden={step !== "extras"} className="flex flex-col gap-3">');
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
  it("the client's own links under one title, the description on the client's page, and the feel for v2 too", () => {
    expect(brief).toContain('t("contest.brief.ownLinks")');
    expect(brief).toContain("withDescription && brief.description.trim() && (");
    // Owner, 2026-10-30: the space beside the styles looked empty; a v2 contest shows its business type's feel, always
    // tagged default for designers. Styles on the left, the feel, colours and uses on the right (uses left for 1–4 styles).
    expect(brief).not.toContain("{!brief.v2 && (");
    expect(brief).toContain('<Block title={t("contest.brief.feel")} tag={brief.v2 && !withDescription ? tag : tagFor("look")}>');
    expect(brief).toContain("const usesLeft = brief.styles.length > 0 && brief.styles.length <= 4;");
    expect(read("src/lib/contests/browse.ts")).toContain("v2: parseCompletion(data.brief_completion) !== null,");
  });
  it("the public summary says how many more requirements there are", () => {
    expect(read("src/app/contest/[slug]/page.tsx")).toContain('t("contest.brief.moreRequirements", { n: fmt(contest.brief.requirements.length - 4) })');
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CHECKING_STAGES, contestStages, progressShare, STAGES, stagesFor } from "@/lib/client/rules";
import { newCompletion } from "@/lib/onboarding/brief-defaults";
import { createTranslator } from "@/lib/i18n/translate";
import en from "@/lib/i18n/messages/en";
import bn from "@/lib/i18n/messages/bn";

// The banner's "keep it" calls the server; here only its pure rule is used.
vi.mock("@/lib/onboarding/brief-actions", () => ({ v2AcceptBrief: vi.fn() }));
const { briefBanner, GREEN_AT } = await import("@/components/client/brief-banner");

// Owner, 2026-10-29 (client-onboarding-v2-spec.md §3 "After পরে করবো"): a client who skipped the brief after paying
// sees a yellow banner on their dashboard and contest page (never a pop-up) until they keep or change it; it turns
// green once 3 designs are in. While a v2 bKash payment waits, the progress shows "Checking" between Paid and Live.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the contest progress", () => {
  const STATUSES = ["draft", "pending_payment", "open", "judging", "no_result", "winner_selected", "handover", "completed", "cancelled", "unknown"];

  it("is exactly as before without the new input", () => {
    expect(STATUSES.map((s) => contestStages(s).join(","))).toEqual([
      "on,,,,,",
      "on,,,,,",
      "done,done,on,,,",
      "done,done,done,on,,",
      "done,done,done,done,on,",
      "done,done,done,done,done,on",
      "done,done,done,done,done,on",
      "done,done,done,done,done,done",
      ",,,,,",
      "on,,,,,",
    ]);
    expect(STATUSES.map((s) => progressShare(s))).toEqual([8, 8, 42, 58, 75, 92, 92, 100, 0, 8]);
    for (const s of STATUSES) {
      expect(stagesFor(s)).toBe(STAGES);
      expect(contestStages(s, { waiting: false })).toEqual(contestStages(s));
      expect(progressShare(s, {})).toBe(progressShare(s));
    }
  });

  it("adds Checking between Paid and Live while a v2 payment waits for approval", () => {
    for (const s of ["draft", "pending_payment"]) {
      expect(stagesFor(s, { waiting: true })).toEqual(["brief", "paid", "checking", "live", "judging", "winner", "files"]);
      expect(contestStages(s, { waiting: true })).toEqual(["done", "done", "on", "", "", "", ""]);
      expect(contestStages(s, { waiting: true })).toHaveLength(stagesFor(s, { waiting: true }).length);
    }
    expect(stagesFor("pending_payment", { waiting: true })).toBe(CHECKING_STAGES);
    expect(progressShare("pending_payment", { waiting: true })).toBe(36);
    // Once approved (or for any later status) the six steps come back, whatever the page passes.
    for (const s of ["open", "judging", "completed", "cancelled"]) {
      expect(stagesFor(s, { waiting: true })).toBe(STAGES);
      expect(contestStages(s, { waiting: true })).toEqual(contestStages(s));
    }
  });
});

describe("the brief banner", () => {
  const fresh = { status: "open", completion: newCompletion(), entries: 0, unrated: 0, waiting: false };

  it("shows only for a v2 contest whose brief still runs on the defaults, after paying, while the brief can change", () => {
    expect(briefBanner({ ...fresh, status: "open" })).toBe("brief");
    for (const status of ["draft", "pending_payment"]) expect(briefBanner({ ...fresh, status, waiting: true })).toBe("brief");
    // Not on an unpaid draft (it has its own "pay to go live" card; no brief nag before paying).
    for (const status of ["draft", "pending_payment"]) expect(briefBanner({ ...fresh, status })).toBeNull();
    for (const status of ["judging", "winner_selected", "handover", "completed", "no_result", "cancelled"]) expect(briefBanner({ ...fresh, status })).toBeNull();
    // An old-wizard contest (no mark) never has one.
    expect(briefBanner({ ...fresh, completion: null })).toBeNull();
  });

  it("is gone for good once the client keeps the brief or changes any part of it", () => {
    expect(briefBanner({ ...fresh, completion: { v: 2, edited: [], acceptedAt: "2026-10-29T08:00:00Z" } })).toBeNull();
    expect(briefBanner({ ...fresh, completion: { v: 2, edited: ["look"], acceptedAt: null } })).toBeNull();
    expect(briefBanner({ ...fresh, entries: 5, unrated: 5, completion: { v: 2, edited: ["links"], acceptedAt: null } })).toBeNull();
  });

  it("turns green from 3 designs, while some are still to rate", () => {
    expect(GREEN_AT).toBe(3);
    expect(briefBanner({ ...fresh, entries: 2, unrated: 2 })).toBe("brief");
    expect(briefBanner({ ...fresh, entries: 3, unrated: 3 })).toBe("entries");
    expect(briefBanner({ ...fresh, entries: 7, unrated: 1 })).toBe("entries");
    expect(briefBanner({ ...fresh, entries: 7, unrated: 0 })).toBeNull();
  });

  it("is a banner, not a pop-up: See the brief opens the hub, Keep calls the server, green opens the designs", () => {
    const src = read("src/components/client/brief-banner.tsx");
    expect(src).toContain('"use client"');
    expect(src).toContain("href={`/start-v2/brief?c=${props.contestId}`}");
    expect(src).toContain("await v2AcceptBrief({ contestId: props.contestId });");
    expect(src).toContain("setKept(true);");
    expect(src).toContain('contestHref(props.slug, "designs", { filter: "unrated" })');
    expect(src).toContain('className="calert info');
    expect(src).toContain('className="calert ok');
    expect(src).toContain("t(`wizard.businessTypes.${props.businessType}`)");
    expect(src).not.toMatch(/role="dialog"|aria-modal|createPortal/);
  });
});

describe("the client pages", () => {
  it("the contest page: the banner at the top for a v2 contest, Checking and its note in the progress", () => {
    const page = read("src/app/client/contests/[id]/page.tsx");
    expect(page).toContain("contestRepository().findContest(contest.id).catch(() => null)");
    expect(page).toContain("{record && completion && onboardingV2On() && (");
    expect(page.indexOf("<BriefBanner")).toBeGreaterThan(-1);
    expect(page.indexOf("<BriefBanner")).toBeLessThan(page.indexOf('className="dth2"'));
    expect(page).toContain("const checking = sent && completion !== null;");
    expect(page).toContain("const stages = contestStages(contest.rawStatus, { waiting: checking });");
    expect(page).toContain("stagesFor(contest.rawStatus, { waiting: checking }).map((st, i) => {");
    expect(page).toContain('st === "checking" ? t("wizardV2.timeline.checking") : t(`cw.detail.steps.${st}`)');
    expect(page).toContain('t("wizardV2.banner.checking", { minutes: num(s["onboarding.approval_minutes"]) })');
    expect(page).toContain('t("wizardV2.banner.tellLive")');
  });

  it("the dashboard: one banner per v2 contest above the live contests, and the bar counts Checking", () => {
    const home = read("src/app/client/page.tsx");
    expect(home).toContain('const banners = onboardingV2On() ? h.contests.flatMap((c) => (v2.has(c.id) ? [{ c, r: v2.get(c.id)! }] : [])) : [];');
    expect(home.indexOf("<BriefBanner")).toBeGreaterThan(-1);
    expect(home.indexOf("<BriefBanner")).toBeLessThan(home.indexOf("data-live-contests"));
    expect(home).toContain("progressShare(c.status, { waiting: waiting && v2.has(c.id) })");
    // The whole row: a database before migration 0079 has no brief_completion, so no contest reads as v2.
    expect(home).toContain('.from("contests").select("*").in("id", ids)');
  });

  it("My contests: Checking in the steps of a v2 contest whose payment waits", () => {
    const my = read("src/app/client/contests/page.tsx");
    expect(my).toContain("const checking = sent && checked.has(c.id);");
    expect(my).toContain("stagesFor(c.status, { waiting: checking }).map((s, i) => (");
    expect(my).toContain('s === "checking" ? t("wizardV2.timeline.checking") : t(`cw.stages.${s}`)');
    // Missing column (before 0079): the query fails, nothing is v2.
    expect(my).toContain('.select("id, brief_completion").in("id", ids)');
  });
});

describe("texts", () => {
  it("every text the banner and the progress use exists in English and Bangla, with its placeholders", () => {
    for (const [locale, messages] of [["en", en], ["bn", bn]] as const) {
      const t = createTranslator(locale, messages as typeof en);
      const keys = ["wizardV2.banner.title", "wizardV2.banner.body", "wizardV2.banner.open", "wizardV2.banner.keep", "wizardV2.banner.entries", "wizardV2.banner.entriesOpen", "wizardV2.banner.checking", "wizardV2.banner.tellLive", "wizardV2.timeline.checking", "cw.status.awaiting", "cw.home.paySent"] as const;
      for (const k of keys) expect(t(k)).not.toBe(k);
      expect(t("wizardV2.banner.title", { n: "82" })).toContain("82");
      expect(t("wizardV2.banner.body", { type: "TYPE" })).toContain("TYPE");
      expect(t("wizardV2.banner.entries", { n: "3" })).toContain("3");
      expect(t("wizardV2.banner.checking", { minutes: "30" })).toContain("30");
    }
  });
});

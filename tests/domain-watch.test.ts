import { describe, expect, it } from "vitest";
import { detailOf, FRESH_STATE, nextState, verdictOf, type Signals, type Verdict, type WatchState } from "@/lib/domain/rules";

/** The .bd watch (owner, 2026-10-21): BTCL dropped logocontest.bd on 2026-10-20 while it was Active and paid. */
const R4 = ["referral", "referral", "referral", "referral"] as const;
const ok: Signals = { us: [...R4], control: [...R4], controlCom: [...R4], publicUs: ["good", "good"], publicBackup: ["good", "good"] };
const sig = (p: Partial<Signals>): Signals => ({ ...ok, ...p });
const UN4: Signals["us"] = ["unreached", "unreached", "unreached", "unreached"];

describe("verdictOf", () => {
  it("healthy when BTCL refers to our name servers", () => {
    expect(verdictOf(ok)).toBe("ok");
    expect(verdictOf(sig({ us: ["referral", "unreached", "referral", "referral"] }))).toBe("ok");
  });

  it("only us: our name is missing while the comparison name in the same list is fine (2026-10-20)", () => {
    expect(verdictOf(sig({ us: ["nxdomain", "nxdomain", "nxdomain", "nxdomain"] }))).toBe("down_us");
    expect(verdictOf(sig({ us: ["nxdomain", "unreached", "nxdomain", "referral"] }))).toBe("down_us");
  });

  it("all of .bd: btcl.bd (same list) is missing too; btcl.com.bd (another list) doesn't count", () => {
    expect(verdictOf(sig({ us: ["nxdomain", "nxdomain", "nxdomain", "nxdomain"], control: ["nxdomain", "nxdomain", "referral", "nxdomain"] }))).toBe("down_all");
    expect(verdictOf(sig({ us: ["nxdomain", "nxdomain", "nxdomain", "nxdomain"], controlCom: ["nxdomain", "nxdomain", "nxdomain", "nxdomain"] }))).toBe("down_us");
  });

  it("a missing comparison name alone never means we are down", () => {
    expect(verdictOf(sig({ control: ["nxdomain", "nxdomain", "nxdomain", "nxdomain"], controlCom: ["nxdomain", "nxdomain", "nxdomain", "nxdomain"] }))).toBe("ok");
  });

  it("stale public answers never hide a BTCL problem", () => {
    expect(verdictOf(sig({ us: ["nxdomain", "nxdomain", "nxdomain", "unreached"], publicUs: ["good", "good"] }))).toBe("down_us");
    expect(verdictOf(sig({ publicUs: ["nxdomain", "good"] }))).toBe("ok");
  });

  it("signing problem: BTCL answers, both public resolvers fail", () => {
    expect(verdictOf(sig({ publicUs: ["servfail", "servfail"] }))).toBe("validation");
  });

  it("both our addresses failing is not BTCL", () => {
    expect(verdictOf(sig({ publicUs: ["nxdomain", "servfail"], publicBackup: ["servfail", "nxdomain"] }))).toBe("both_down");
  });

  it("without BTCL's servers it goes by the public resolvers, and a lone 'doesn't exist' from BTCL means unknown", () => {
    expect(verdictOf(sig({ us: UN4, control: UN4 }))).toBe("ok_public");
    expect(verdictOf(sig({ us: UN4, control: UN4, publicUs: ["nxdomain", "nxdomain"] }))).toBe("down_public");
    expect(verdictOf(sig({ us: UN4, control: UN4, publicUs: ["nosignal", "nosignal"] }))).toBe("unknown");
    expect(verdictOf(sig({ us: UN4, control: UN4, publicUs: ["good", "nxdomain"] }))).toBe("unknown");
    expect(verdictOf(sig({ us: ["unreached", "unreached", "unreached", "nxdomain"], publicUs: ["good", "good"] }))).toBe("unknown");
  });

  it("short detail codes only", () => {
    expect(detailOf(sig({ us: ["nxdomain", "unreached", "referral", "referral"] }), 2024278723)).toBe("us=nx,un,ref,ref ctl=ref,ref,ref,ref com=ref,ref,ref,ref pub=good,good backup=good,good serial=2024278723");
  });
});

describe("nextState", () => {
  const t0 = new Date("2026-10-20T10:00:00Z");
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);
  const run = (verdicts: Verdict[], strong: boolean | boolean[] = false, start: WatchState = FRESH_STATE(t0)) => {
    let s = start;
    const alerts: (string | null)[] = [];
    verdicts.forEach((v, i) => {
      const r = nextState(s, v, Array.isArray(strong) ? strong[i] : strong, at(i * 5), "d");
      s = r.state;
      alerts.push(r.alert);
    });
    return { s, alerts };
  };

  it("goes down after two bad checks in a row, or one when 3+ servers say it doesn't exist", () => {
    expect(run(["down_us"]).alerts).toEqual([null]);
    expect(run(["down_us", "down_us"]).alerts).toEqual([null, "down"]);
    expect(run(["down_us", "down_us"]).s.state).toBe("down");
    expect(run(["down_us"], true).alerts).toEqual(["down"]);
    expect(run(["down_us", "ok", "down_us"]).alerts).toEqual([null, null, null]);
  });

  it("unknown changes nothing while healthy", () => {
    expect(run(["down_us", "unknown", "down_us"]).alerts).toEqual([null, null, "down"]);
  });

  it("back only after two good answers from BTCL's own servers in a row", () => {
    const r = run(["down_us", "down_us", "ok", "down_us", "ok", "ok"]);
    expect(r.alerts).toEqual([null, "down", null, null, null, "back"]);
    expect(r.s.state).toBe("ok");
    // Public resolvers alone (maybe remembering) never end an outage, and an unknown breaks the run.
    expect(run(["down_us", "down_us", "ok_public", "ok_public", "ok_public"]).alerts).toEqual([null, "down", null, null, null]);
    expect(run(["down_us", "down_us", "ok", "unknown", "ok"]).alerts).toEqual([null, "down", null, null, null]);
  });

  it("a flapping BTCL doesn't raise a new alarm within an hour of coming back on one bad check", () => {
    const r = run(["down_us", "down_us", "ok", "ok", "down_us", "ok", "down_us", "down_us"], [false, false, false, false, true, false, true, true]);
    expect(r.alerts).toEqual([null, "down", null, "back", null, null, null, "down"]);
  });

  it("reminds every 3 hours while down, and after 30 minutes when the kind of trouble changes", () => {
    let s: WatchState = FRESH_STATE(t0);
    const alerts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const r = nextState(s, "down_all", false, at(i * 5), "d");
      s = r.state;
      if (r.alert) alerts.push(`${i}:${r.alert}`);
    }
    expect(alerts).toEqual(["1:down", "37:reminder"]);
    expect(s.kind).toBe("down_all");
    const changed = run(["both_down", "both_down", "down_us", "down_us", "down_us", "down_us", "down_us", "down_us", "down_us"]);
    // Down at 5 minutes as both_down; down_us from 10 minutes; its own message 30 minutes after the first one.
    expect(changed.alerts).toEqual([null, "down", null, null, null, null, null, "reminder", null]);
    expect(changed.s.kind).toBe("down_us");
  });

  it("an alert that reached nobody is tried again on the next check", () => {
    const { s } = run(["down_us", "down_us"]);
    const retry = nextState({ ...s, lastAlertAt: null }, "down_us", false, at(10), "d");
    expect(retry.alert).toBe("reminder");
  });
});

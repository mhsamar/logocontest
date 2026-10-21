import { describe, expect, it } from "vitest";
import { detailOf, FRESH_STATE, nextState, verdictOf, type Signals, type Verdict, type WatchState } from "@/lib/domain/rules";

/** The .bd watch (owner, 2026-10-21): BTCL dropped logocontest.bd on 2026-10-20 while it was Active and paid. */
const ok: Signals = { us: ["referral", "referral", "referral", "referral"], control: ["referral", "referral", "referral", "referral"], publicUs: ["good", "good"], publicBackup: ["good", "good"] };
const sig = (p: Partial<Signals>): Signals => ({ ...ok, ...p });

describe("verdictOf", () => {
  it("healthy when BTCL refers to our name servers", () => {
    expect(verdictOf(ok)).toBe("ok");
    expect(verdictOf(sig({ us: ["referral", "unreached", "referral", "referral"] }))).toBe("ok");
  });

  it("only us: our name is missing while the control name is fine (2026-10-20)", () => {
    expect(verdictOf(sig({ us: ["nxdomain", "nxdomain", "nxdomain", "nxdomain"] }))).toBe("down_us");
    expect(verdictOf(sig({ us: ["nxdomain", "unreached", "nxdomain", "referral"] }))).toBe("down_us");
  });

  it("all of .bd: the control name is missing too", () => {
    expect(verdictOf(sig({ us: ["nxdomain", "nxdomain", "nxdomain", "nxdomain"], control: ["nxdomain", "nxdomain", "referral", "nxdomain"] }))).toBe("down_all");
  });

  it("stale public answers never hide a BTCL problem, and never block recovery", () => {
    expect(verdictOf(sig({ us: ["nxdomain", "nxdomain", "nxdomain", "unreached"], publicUs: ["good", "good"] }))).toBe("down_us");
    expect(verdictOf(sig({ publicUs: ["nxdomain", "good"] }))).toBe("ok");
  });

  it("signing problem: BTCL answers, both public resolvers fail", () => {
    expect(verdictOf(sig({ publicUs: ["servfail", "servfail"] }))).toBe("validation");
  });

  it("both our addresses failing is not BTCL", () => {
    expect(verdictOf(sig({ publicUs: ["nxdomain", "servfail"], publicBackup: ["servfail", "nxdomain"] }))).toBe("both_down");
  });

  it("without the .bd servers (UDP blocked) it goes by the public resolvers", () => {
    const blocked = { us: ["unreached", "unreached", "unreached", "unreached"], control: ["unreached", "unreached", "unreached", "unreached"] } as Pick<Signals, "us" | "control">;
    expect(verdictOf(sig({ ...blocked }))).toBe("ok");
    expect(verdictOf(sig({ ...blocked, publicUs: ["nxdomain", "nxdomain"] }))).toBe("down_us");
    expect(verdictOf(sig({ ...blocked, publicUs: ["nosignal", "nosignal"] }))).toBe("unknown");
    expect(verdictOf(sig({ ...blocked, publicUs: ["good", "nxdomain"] }))).toBe("unknown");
  });

  it("short detail codes only", () => {
    expect(detailOf(sig({ us: ["nxdomain", "unreached", "referral", "referral"] }), 2024278723)).toBe("us=nx,un,ref,ref ctl=ref,ref,ref,ref pub=good,good backup=good,good serial=2024278723");
  });
});

describe("nextState", () => {
  const t0 = new Date("2026-10-20T10:00:00Z");
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);
  const run = (verdicts: Verdict[], strong = false) => {
    let s: WatchState = FRESH_STATE(t0);
    const alerts: (string | null)[] = [];
    verdicts.forEach((v, i) => {
      const r = nextState(s, v, strong, at(i * 5), "d");
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

  it("unknown changes nothing", () => {
    expect(run(["down_us", "unknown", "down_us"]).alerts).toEqual([null, null, "down"]);
  });

  it("back after two good checks; a flap goes straight back to down without a second alert storm", () => {
    const r = run(["down_us", "down_us", "ok", "down_us", "ok", "ok"]);
    expect(r.alerts).toEqual([null, "down", null, null, null, "back"]);
    expect(r.s.state).toBe("ok");
  });

  it("reminds every 3 hours while down", () => {
    let s: WatchState = FRESH_STATE(t0);
    const alerts: (string | null)[] = [];
    for (let i = 0; i <= 40; i++) {
      const r = nextState(s, "down_all", false, at(i * 5), "d");
      s = r.state;
      if (r.alert) alerts.push(`${i}:${r.alert}`);
    }
    expect(alerts).toEqual(["1:down", "37:reminder"]);
    expect(s.kind).toBe("down_all");
  });
});

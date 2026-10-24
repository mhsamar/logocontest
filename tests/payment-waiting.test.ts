import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mainAction } from "@/lib/client/rules";

// Owner, 2026-10-25: a client who sent a bKash payment saw "Not paid" and "Finish payment" on their dashboard while an
// admin was checking it. Now every client view shows "Waiting for approval" with "View payment", and To do drops it.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a payment waiting for approval", () => {
  it("has its own action instead of Finish payment", () => {
    expect(mainAction("pending_payment", true)).toBe("waiting");
    expect(mainAction("draft", true)).toBe("waiting");
    expect(mainAction("pending_payment")).toBe("pay");
    expect(mainAction("open", true)).toBe("review");
  });

  it("shows on the dashboard card, My contests and the contest page", () => {
    const home = read("src/app/client/page.tsx");
    expect(home).toContain("const waiting = h.payLinks.has(c.id);");
    expect(home).toContain("<StatusPill status={c.status} waiting={waiting} t={t} />");
    expect(home).toContain('t(waiting ? "cw.home.paySent" : "cw.home.briefReady")');
    const my = read("src/app/client/contests/page.tsx");
    expect(my).toContain("mainAction(c.status, sent)");
    expect(my).toContain('t(sent ? "cw.my.waitingStep" : "cw.my.briefStep")');
    const page = read("src/app/client/contests/[id]/page.tsx");
    expect(page).toContain("mainAction(contest.rawStatus, sent)");
    expect(page).toContain('t(sent ? "cw.action.waiting" : "cw.action.pay")');
    expect(read("src/components/client/parts.tsx")).toContain('t("cw.status.awaiting")');
  });

  it("leaves nothing for the client to do", () => {
    expect(read("src/lib/client/workspace.ts")).toContain("...unpaid.filter((c) => !waiting.has(c.id)).map(");
  });
});

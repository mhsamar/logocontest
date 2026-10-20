import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { heldAfterRemoval } from "@/lib/entries/relevance-rules";
import { APPROVE_ALL_REASON } from "@/lib/entries/rules";
import { parseSetting } from "@/lib/settings/registry";

// Every design waits for approval (owner, 2026-10-20): a switch in Admin › Settings, off by default.
describe("every design waits for approval", () => {
  it("is off until an admin turns it on", () => {
    expect(parseSetting("designs.approve_all", undefined)).toBe(false);
  });
  it("a new design is held with its own reason when the switch is on; the design check's holds come first", () => {
    const src = readFileSync("src/lib/entries/actions.ts", "utf8");
    expect(src).toContain('getSetting("designs.approve_all")');
    expect(src).toMatch(/check\?\.held\s*\?[\s\S]*:\s*approveAll\s*\?\s*\{ status: "held", held_at: now, held_reason: APPROVE_ALL_REASON, held_positions: \[\] \}/);
  });
  it("taking a picture off never publishes a design that waits for approval", () => {
    expect(heldAfterRemoval({ positions: [], reason: APPROVE_ALL_REASON }, [0, 2])).toEqual({ positions: [], reason: APPROVE_ALL_REASON, clear: false });
    // A design the check held: its last doubted picture removed while every design waits → still waiting.
    expect(heldAfterRemoval({ positions: [1], reason: "Picture 2: nude" }, [0, 2], true)).toEqual({ positions: [], reason: APPROVE_ALL_REASON, clear: false });
    // With the switch off, removing the last doubted picture publishes it, as before.
    expect(heldAfterRemoval({ positions: [1], reason: "Picture 2: nude" }, [0, 2]).clear).toBe(true);
  });
  it("Admin › Designs › To approve keeps Approve and Remove on every waiting design", () => {
    const page = readFileSync("src/app/admin/entries/page.tsx", "utf8");
    expect(page).toContain("run={approveEntry.bind(null, e.id)}");
    expect(page).toContain('t(approveAll ? "admin.entries.held.noneAll" : "admin.entries.held.none")');
  });
});

describe("what the designer sees while every design waits", () => {
  it("a neutral note (no 'doubted picture'), after sending, on the design and on the dashboard", async () => {
    const en = (await import("@/lib/i18n/messages/en")).default;
    expect(en.entry.heldNotice.mineAll).not.toMatch(/doubt|nude|sexual/i);
    expect(en.submit.done.heldAllBody).not.toMatch(/doubt|nude|sexual/i);
    expect(readFileSync("src/app/contest/[slug]/page.tsx", "utf8")).toContain('entry.heldAll ? "mine_all" : "mine"');
    expect(readFileSync("src/components/dashboard/my-designs.tsx", "utf8")).toContain('current.heldAll ? "mine_all" : "mine"');
    expect(readFileSync("src/components/entries/submit-form.tsx", "utf8")).toContain('heldAll ? "submit.done.heldAllTitle"');
    expect(readFileSync("src/lib/entries/actions.ts", "utf8")).toContain("heldAll: waits && !check?.held");
  });
});

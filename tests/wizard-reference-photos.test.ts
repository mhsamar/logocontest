import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Owner, 2026-10-22: logo contests lost their reference photos when the client went to "Invite Pro designers" before
// the review step (the only place the photos were uploaded), because the wizard came back with an empty list. Now the
// photos wait on the device under the draft's own key and the review uploads them on the way back.
const wizard = readFileSync(join(process.cwd(), "src/components/wizard/wizard.tsx"), "utf8");
const state = readFileSync(join(process.cwd(), "src/components/wizard/state.ts"), "utf8");

describe("logo wizard reference photos", () => {
  it("keeps them under the draft before every jump to the invite page", () => {
    const jumps = [...wizard.matchAll(/router\.push\(`\/start\/invite\?draft=\$\{(\w+)\.contestId\}`\)/g)];
    expect(jumps.length).toBe(2);
    for (const j of jumps) expect(wizard.slice(Math.max(0, j.index! - 120), j.index!), j[0]).toContain(`savePending(${j[1]}.contestId, state.localFiles)`);
  });

  it("brings them back when the draft is resumed, and the review uploads them", () => {
    expect(wizard).toContain("const pending = loadPending(props.resume.contestId)");
    expect(wizard).toMatch(/if \(saved\.ok\) await uploadPending\(saved\.contestId, state\)/);
  });

  it("each uploaded photo leaves the list at once, so a reload never sends it twice", () => {
    expect(wizard).toContain("const localFiles = cur.localFiles.filter((x) => x.id !== id);\n          savePending(contestId, localFiles);");
    expect(wizard).toContain("if (s.localFiles.length === 0 || uploadRun.current) return;");
    expect(state).toContain("lc-wizard-pending:");
  });
});

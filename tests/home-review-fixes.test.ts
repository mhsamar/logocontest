import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The new home page's review (2026-10-29): what is shown to every visitor stays truthful and current.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const body = (file: string, fn: string) => {
  const s = read(file);
  const i = s.indexOf(`export async function ${fn}(`);
  return s.slice(i, s.indexOf("\nexport ", i + 1));
};

describe("new home page: review fixes", () => {
  it("the designers wall shows only designers who confirmed their email", () => {
    expect(read("src/lib/home/designer-wall.ts")).toContain('.not("email_verified_at", "is", null)');
  });

  it("a banned, suspended, deleted, test-marked or renamed designer, or a new photo, clears the wall and the winners at once", () => {
    for (const fn of ["giveStrike", "removeStrike", "setUserStatus", "setTestAccount", "correctUserName"]) expect(body("src/lib/admin/user-actions.ts", fn), fn).toContain("homeDesignersChanged()");
    for (const fn of ["updateProfile", "saveAvatar", "removeAvatar"]) expect(body("src/lib/profile/actions.ts", fn), fn).toContain("homeDesignersChanged()");
    for (const fn of ["trashUser", "restoreUser"]) expect(body("src/lib/admin/trash.ts", fn), fn).toContain("homeDesignersChanged()");
    expect(read("src/lib/home/designer-wall.ts")).toMatch(/homeDesignersChanged\(\) \{[\s\S]*?homeLogosChanged\(\);/);
  });

  it("the winners show only active designers", () => {
    expect(read("src/lib/home/winners.ts")).toContain('f.designerStatus === "active"');
  });

  it("'Invite Pro designers' is one rule for the band and the pricing cards: real, active Pro designers, counted without a list of ids", () => {
    const rule = read("src/lib/pro/invites-open.ts");
    expect(rule).toContain('.eq("p.is_test", false)');
    expect(rule).toContain('.eq("p.status", "active")');
    expect(rule).not.toContain(".in(");
    for (const f of ["src/components/home/landing/ask-band.tsx", "src/components/home/landing/pricing.tsx"]) expect(read(f), f).toContain("invitesOpenForClients().catch(() => false)");
  });

  it("the moving rows stop only for keyboard focus, so a click on a card always opens it", () => {
    for (const f of ["src/components/home/landing/wall.css", "src/components/home/landing/winners.css"]) {
      expect(read(f), f).toContain(":has(:focus-visible)");
      expect(read(f), f).not.toContain(":focus-within .lc-");
    }
  });

  it("no payment chip in the hero while nothing is open in the visitor's currency", () => {
    expect(read("src/components/home/landing/hero.tsx")).toContain("{pay && <span");
  });
});

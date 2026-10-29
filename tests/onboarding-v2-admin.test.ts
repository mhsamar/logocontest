import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUSINESS_TYPES, DELIVERABLES, LOGO_STYLES, REQUIREMENTS, STYLE_SLIDERS, USED_ON } from "@/lib/contests/brief";
import { defaultsFor, SEED } from "@/lib/onboarding/brief-defaults";
import { SETTINGS } from "@/lib/settings/registry";
import en from "@/lib/i18n/messages/en";
import bn from "@/lib/i18n/messages/bn";

// Owner, 2026-10-29 (client-onboarding-v2-spec.md §3): Admin › Onboarding changes the brief a new onboarding v2 contest
// starts with, per business type (setting onboarding.brief_defaults); a type without its own uses "Other".
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ settings: [] as Row[], conflict: [] as unknown[], fail: false }));
const who = vi.hoisted(() => ({ admin: null as null | Row }));
const sent = vi.hoisted(() => ({ audits: [] as unknown[][], changed: 0, refreshed: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => void sent.refreshed++, unstable_cache: (fn: unknown) => fn, updateTag: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/admin/core", () => ({ adminUser: async (perm: string) => (perm === "content.manage" ? who.admin : null), audit: async (...a: unknown[]) => void sent.audits.push(a) }));
vi.mock("@/lib/settings", async () => {
  const { parseSetting } = await import("@/lib/settings/registry");
  return {
    getSetting: async (key: string) => parseSetting(key as "onboarding.brief_defaults", db.settings.find((r) => r.key === key)?.value),
    settingsChanged: () => void sent.changed++,
  };
});
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: async (row: Row, opts: unknown) => {
        if (db.fail) return { error: { message: "down" } };
        db.settings = [...db.settings.filter((r) => r.key !== row.key), row];
        db.conflict.push(opts);
        return { error: null };
      },
    }),
  }),
}));

const KEY = "onboarding.brief_defaults";
const mine = { styles: ["mascot", "emblem"], sliders: { complexity: 1, era: 5, tone: 4 }, usedOn: ["video"], deliverables: [], requirements: ["trust"] };

beforeEach(() => {
  db.settings = [];
  db.conflict = [];
  db.fail = false;
  who.admin = { id: "a1" };
  sent.audits = [];
  sent.changed = 0;
  sent.refreshed = 0;
});

describe("the brief defaults check", () => {
  it("keeps every business type's valid entry, drops unknown keys and extra fields, and names the broken ones", async () => {
    const { checkBriefDefaults } = await import("@/lib/onboarding/defaults-actions");
    expect(await checkBriefDefaults(SEED)).toEqual({ entries: SEED, bad: [] });
    const r = await checkBriefDefaults({ beauty: { ...mine, audience: "x" }, pizza: mine, other: SEED.other, food: { ...mine, sliders: { complexity: 0, era: 3, tone: 3 } }, travel: { ...mine, styles: ["neon"] } });
    expect(r.entries).toEqual({ beauty: mine, other: SEED.other });
    expect(r.bad).toEqual(["food", "travel"]);
    // Repeats go, the order stays; too many or a slider that isn't a whole 1–5 is broken.
    expect((await checkBriefDefaults({ other: { ...mine, styles: ["emblem", "mascot", "emblem"], requirements: ["trust", "trust"] } })).entries.other).toMatchObject({ styles: ["emblem", "mascot"], requirements: ["trust"] });
    expect((await checkBriefDefaults({ other: { ...mine, sliders: { complexity: 2.5, era: 3, tone: 3 } } })).bad).toEqual(["other"]);
    expect((await checkBriefDefaults({ other: { ...mine, usedOn: [...USED_ON, "social"] } })).bad).toEqual(["other"]);
    for (const raw of [null, "x", [SEED.other], 3]) expect(await checkBriefDefaults(raw)).toEqual({ entries: {}, bad: [] });
  });

  it("whatever it keeps is read back as it is by the wizard (defaultsFor), and the setting accepts it", async () => {
    const { checkBriefDefaults } = await import("@/lib/onboarding/defaults-actions");
    const { entries } = await checkBriefDefaults({ ...SEED, beauty: mine });
    for (const type of BUSINESS_TYPES) if (entries[type]) expect(defaultsFor(entries, type)).toEqual(entries[type]);
    expect(defaultsFor(entries, "travel")).toEqual(SEED.other);
    expect(SETTINGS[KEY].schema.safeParse(entries).success).toBe(true);
  });
});

describe("saving the brief defaults", () => {
  it("needs Content · manage, like the rest of Admin › Onboarding", async () => {
    const { saveBriefDefaults } = await import("@/lib/onboarding/defaults-actions");
    who.admin = null;
    expect(await saveBriefDefaults(SEED)).toEqual({ ok: false, error: "auth.errors.generic" });
    expect(db.settings).toEqual([]);
    expect(sent.changed).toBe(0);
    expect(sent.audits).toEqual([]);
  });

  it("refuses a broken entry or a missing \"Other\", and saves nothing", async () => {
    const { saveBriefDefaults } = await import("@/lib/onboarding/defaults-actions");
    expect(await saveBriefDefaults({ food: SEED.food })).toEqual({ ok: false, error: "admin.errors.generic" });
    expect(await saveBriefDefaults({ other: SEED.other, food: { ...SEED.food, styles: ["neon"] } })).toEqual({ ok: false, error: "admin.errors.generic" });
    expect(await saveBriefDefaults("nope")).toEqual({ ok: false, error: "admin.errors.generic" });
    expect(db.settings).toEqual([]);
    expect(sent.changed).toBe(0);
  });

  it("saves the settings row (json, onboarding), clears the settings cache and writes the audit log", async () => {
    const { saveBriefDefaults } = await import("@/lib/onboarding/defaults-actions");
    expect(await saveBriefDefaults({ other: SEED.other, beauty: mine, pizza: mine })).toEqual({ ok: true });
    expect(db.settings).toHaveLength(1);
    expect(db.settings[0]).toMatchObject({ key: KEY, value: { other: SEED.other, beauty: mine }, type: "json", group: "onboarding", updated_by: "a1" });
    expect(db.settings[0].value).not.toHaveProperty("pizza");
    expect(db.conflict).toEqual([{ onConflict: "key" }]);
    expect(sent.changed).toBe(1);
    expect(sent.refreshed).toBe(1);
    // Before the first save the setting is the seed.
    expect(sent.audits).toEqual([["a1", "update_brief_defaults", "settings", KEY, { from: SEED, to: { beauty: mine, other: SEED.other } }]]);
    // The next save starts from what was saved.
    expect(await saveBriefDefaults(SEED)).toEqual({ ok: true });
    expect(sent.audits[1][4]).toEqual({ from: { beauty: mine, other: SEED.other }, to: SEED });
  });

  it("a failed write still clears the cache and says so, with no audit row", async () => {
    const { saveBriefDefaults } = await import("@/lib/onboarding/defaults-actions");
    db.fail = true;
    expect(await saveBriefDefaults(SEED)).toEqual({ ok: false, error: "auth.errors.generic" });
    expect(sent.changed).toBe(1);
    expect(sent.audits).toEqual([]);
  });
});

describe("the editor on Admin › Onboarding", () => {
  it("\"Back to the original\" is the seed: its six types have their own, the rest are the same as Other", async () => {
    const { seedRows, toSaved } = await import("@/components/admin/onboarding/brief-defaults-editor");
    const rows = seedRows();
    expect(rows.map((r) => r.type)).toEqual([...BUSINESS_TYPES]);
    expect(rows.filter((r) => r.own).map((r) => r.type).sort()).toEqual(Object.keys(SEED).sort());
    expect(rows.find((r) => r.type === "beauty")?.values).toEqual(SEED.other);
    expect(toSaved(rows)).toEqual(SEED);
    // A type set to "Same as Other" isn't saved; "Other" always is.
    expect(Object.keys(toSaved(rows.map((r) => ({ ...r, own: false }))))).toEqual(["other"]);
  });

  it("shows it for the client flow only, from the setting, below the questions editor", () => {
    const page = read("src/app/admin/onboarding/page.tsx");
    expect(page).toContain('getSetting("onboarding.brief_defaults")');
    expect(page).toContain('flow === "client" && <BriefDefaultsEditor');
    expect(page.indexOf("<OnboardingEditor")).toBeLessThan(page.indexOf("<BriefDefaultsEditor"));
    expect(page).toMatch(/BUSINESS_TYPES\.map\(\(type\) => \(\{ type, own: type === "other" \|\| /);
    const actions = read("src/lib/onboarding/defaults-actions.ts");
    expect(actions.startsWith('"use server";')).toBe(true);
    expect(actions).toContain('adminUser("content.manage")');
  });

  it("every text it uses exists in English and Bangla", () => {
    const editor = read("src/components/admin/onboarding/brief-defaults-editor.tsx");
    const keys = [...editor.matchAll(/t\("(wizardV2\.admin\.\w+)"\)/g)].map((m) => m[1]);
    expect(new Set(keys)).toEqual(new Set(["wizardV2.admin.defaultsTitle", "wizardV2.admin.defaultsHelp", "wizardV2.admin.type", "wizardV2.admin.own", "wizardV2.admin.sameAsOther", "wizardV2.admin.styles", "wizardV2.admin.feel", "wizardV2.admin.usedOn", "wizardV2.admin.deliverables", "wizardV2.admin.requirements", "wizardV2.admin.saved", "wizardV2.admin.reset", "wizardV2.admin.save"]));
    const at = (m: unknown, path: string) => path.split(".").reduce<unknown>((n, p) => (n as Record<string, unknown> | undefined)?.[p], m);
    const labels = [
      ...keys,
      ...BUSINESS_TYPES.map((x) => `wizard.businessTypes.${x}`),
      ...LOGO_STYLES.map((x) => `wizard.styles.${x}`),
      ...STYLE_SLIDERS.flatMap((x) => [`wizard.sliders.${x}.left`, `wizard.sliders.${x}.right`]),
      ...USED_ON.map((x) => `wizard.usedOn.${x}`),
      ...DELIVERABLES.map((x) => `wizard.deliverables.${x}.title`),
      ...REQUIREMENTS.map((x) => `wizard.requirements.${x}`),
    ];
    for (const k of labels) for (const m of [en, bn]) expect(typeof at(m, k), k).toBe("string");
  });
});

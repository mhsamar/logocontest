import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isBriefPath } from "@/lib/contests/brief-file-rules";

// Owner, 2026-10-22: a client editing a live contest could not add reference photos, and the team had no way to put
// the photos a client sent on WhatsApp on the contest. Edit details now has a photos card, and A-02 an admin card.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ID = "9f967f6b-b181-444b-991d-268cce498b56";
const FILE = "0b4d1c2e-3f5a-4b6c-8d7e-9f0a1b2c3d4e";

describe("reference file paths", () => {
  it("only accepts our own paths in this contest's folder", () => {
    expect(isBriefPath(ID, `${ID}/${FILE}.jpg`)).toBe(true);
    expect(isBriefPath(ID, `${ID}/${FILE}.pdf`, "application/pdf")).toBe(true);
    expect(isBriefPath(ID, `819dea5e-b544-443d-b288-f991603f43ae/${FILE}.jpg`)).toBe(false);
    expect(isBriefPath(ID, `${ID}/../x/${FILE}.jpg`)).toBe(false);
    expect(isBriefPath(ID, `${ID}/${FILE}.svg`)).toBe(false);
    expect(isBriefPath("not-a-contest", `not-a-contest/${FILE}.jpg`)).toBe(false);
  });

  it("checks the extension matches the type when given", () => {
    expect(isBriefPath(ID, `${ID}/${FILE}.png`, "image/png")).toBe(true);
    expect(isBriefPath(ID, `${ID}/${FILE}.png`, "image/jpeg")).toBe(false);
    expect(isBriefPath(ID, `${ID}/${FILE}.jpg`, "image/webp")).toBe(false);
  });
});

describe("live contest photos (client and staff)", () => {
  const files = read("src/lib/contests/brief-files.ts");
  const edit = read("src/lib/contests/edit-actions.ts");
  const wizard = read("src/lib/contests/actions.ts");
  const form = read("src/components/manage/edit-brief-form.tsx");

  it("keeps the shared file code out of the browser-callable actions", () => {
    expect(files).toContain('import "server-only"');
    expect(files).not.toMatch(/^"use server";/m);
  });

  it("never removes a stored file that is already recorded", () => {
    expect(files).toMatch(/from\("contest_files"\)\.select\("id"\)\.eq\("path", path\)/);
  });

  it("checks the stored file's real type and size, and counts again after saving", () => {
    expect(files).toContain("storage.stat(BRIEF_FILES_BUCKET, f.path)");
    expect(files).toContain("stored.mimetype !== f.type");
    expect(files).toContain("stored.size > limits.maxBytes");
    expect(files).toContain("mime_type: stored.mimetype");
    // Two saves at once: the earliest files keep their places and only the extra one is undone.
    expect(files).toContain('.order("created_at", { ascending: true })');
    expect(files).toContain("!first.some((r) => r.id === data.id)");
  });

  it("lets only the contest's client, or staff with Contests › Manage, change an open contest", () => {
    expect(edit).toContain('adminUser("contests.manage")');
    expect(edit).toContain("contest.clientId !== user.id");
    expect(edit).toContain('editor.contest.status === "open"');
    expect(edit).not.toContain('user?.role === "admin"');
  });

  it("tells nobody when the contest closed before the save", () => {
    expect(edit).toContain('.eq("status", "open")\n    .select("id")');
    expect(edit).toContain('if (!data?.length) return { ok: false, error: "manage.edit.closed" }');
  });

  it("leaves the wizard's own upload rules as they were", () => {
    expect(wizard).toContain('return contest.status === "draft" || contest.status === "pending_payment" ? contest : null;');
  });

  it("checks the text first, then removes, then uploads, then saves once", () => {
    const save = form.slice(form.indexOf("const save = async () =>"));
    const order = ["validateBrief(cleanBrief(brief), hiddenSet)", "await sendPhotos()", "const res = await finish()"].map((x) => save.indexOf(x));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const send = form.slice(form.indexOf("const sendPhotos"), form.indexOf("const save = async () =>"));
    expect(send.indexOf("removeLiveBriefFile")).toBeLessThan(send.indexOf("prepareLiveBriefUpload"));
    expect(form).toContain("<FilesStep");
  });

  it("still tells designers when some photos changed but others failed", () => {
    expect(form).toContain("if (changed.current && (await finish().catch(() => null))?.ok) changed.current = false;");
  });

  it("stays locked after saving, and waits for photos still being made lighter", () => {
    expect(form).toContain("if (running.current || pickingRef.current) return;");
    expect(form).toContain("if (!leaving) {");
  });

  it("takes one pick at a time, added to the latest list", () => {
    const step = read("src/components/wizard/steps-order.tsx");
    expect(step).toContain("if (!list || disabled || workingRef.current) return;");
    // A pick that ends late (even after Next) is added to the list as it is by then, and changes nothing else.
    expect(step).toContain("if (added.length) onChange((files) => [...files, ...added]);");
    expect(read("src/components/wizard/wizard.tsx")).toContain("onChange={(change) => setState((cur) => (cur ? { ...cur, localFiles: change(cur.localFiles) } : cur))}");
    expect(read("src/components/services/service-wizard.tsx")).toContain("onChange={(change) => setD((cur) => ({ ...cur, localFiles: change(cur.localFiles ?? []) }))}");
  });

  it("lets a non-logo contest change only its photos", () => {
    expect(form).toContain("!photosOnly && STEPS.map");
    expect(form).toContain("photosOnly ? tellLivePhotos(contestId) : saveContestBrief(contestId, brief)");
    expect(read("src/app/dashboard/contests/[slug]/edit/page.tsx")).toContain('photosOnly={contest.service !== "logo"}');
  });

  it("locks the form while saving and keeps picked photos in memory", () => {
    expect(form).toContain('<fieldset disabled={busy}');
    expect(form).toContain("store={holder}");
    expect(form).not.toContain("file-store");
  });
});

describe("admin reference photos card", () => {
  const actions = read("src/lib/admin/contest-actions.ts");
  const page = read("src/app/admin/contests/[slug]/page.tsx");

  it("needs Contests › Manage and stays away from the Trash", () => {
    const part = actions.slice(actions.indexOf("// A-02 Reference photos"));
    expect(part).toContain('adminUser("contests.manage")');
    expect(part.match(/status === "deleted"/g)?.length).toBe(3);
    expect(part).toContain('audit(admin.id, "add_contest_files"');
    expect(part).toContain('"remove_contest_file"');
  });

  it("tells designers only while the contest is open, once per batch", () => {
    const tell = actions.slice(actions.indexOf("export async function tellAboutContestFiles"));
    expect(tell).toContain('if (c.status !== "open") return { ok: true };');
    expect(tell).toContain('if (last?.action !== "add_contest_files") return { ok: true };');
    expect(tell).toContain('audit(admin.id, "tell_contest_files"');
    expect(tell).toContain('notify(designers, "brief_updated"');
    const card = read("src/components/admin/contest-files.tsx");
    expect(card).toContain("if (open && designers > 0 && tell) await tellAboutContestFiles(contestId)");
    expect(card.indexOf("tellAboutContestFiles(contestId)")).toBeGreaterThan(card.lastIndexOf("addContestFiles(contestId"));
  });

  it("sits on the contest page with a jump button", () => {
    expect(page).toContain("<AdminContestFiles");
    expect(page).toContain('href="#reference-photos"');
  });

  it("keys brief tiles by position, as phone photos often share a name", () => {
    expect(read("src/components/contests/contest-brief.tsx")).not.toContain("key={f.name}");
    expect(read("src/components/services/service-brief.tsx")).not.toContain("key={f.name}");
  });
});

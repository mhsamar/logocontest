import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUSINESS_CARD_FIELDS, cleanAnswers, DEFAULT_SERVICES, LIMITS, parseService, privateKeys, visibleAnswers } from "@/lib/services/types";

// Owner, 2026-10-17: the business card brief, private answers, reference images and the visitor's first step.

const card = DEFAULT_SERVICES.find((s) => s.slug === "business_card")!;

describe("business card brief", () => {
  it("asks every part of the owner's list, keeping the old keys of earlier contests", () => {
    const keys = BUSINESS_CARD_FIELDS.map((f) => f.key);
    for (const k of ["industry", "website", "colour_choice", "colours", "reference", "reference_notes", "style", "avoid", "card_name", "job_title", "card_phone", "card_email", "office_address", "qr_link", "front_side", "back_side", "card_size", "custom_size", "orientation", "print_type", "notes"]) expect(keys).toContain(k);
    // Earlier business card contests answered these.
    for (const k of ["card_name", "logo_link", "colours"]) expect(keys).toContain(k);
    expect(card.fields).toBe(BUSINESS_CARD_FIELDS);
    expect(BUSINESS_CARD_FIELDS.length).toBeLessThanOrEqual(LIMITS.fields);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("offers the owner's choices", () => {
    const opt = (k: string) => BUSINESS_CARD_FIELDS.find((f) => f.key === k)!.options.map((o) => o.en);
    expect(opt("style")).toEqual(["Modern", "Minimal", "Professional", "Luxury", "Creative", "Bold", "Other"]);
    expect(opt("orientation")).toEqual(["Horizontal", "Vertical"]);
    expect(opt("print_type")).toEqual(["Single-sided", "Double-sided"]);
    expect(opt("back_side")).toEqual(["Contact details", "QR code", "Social media links", "Office address", "Other"]);
    expect(opt("reference")).toHaveLength(3);
  });

  it("the card's phone, email, address and QR link are private", () => {
    expect(privateKeys(card).sort()).toEqual(["card_email", "card_phone", "office_address", "qr_link"]);
    expect(card.clientInstruction.en).toContain("only to the winning designer");
    expect(card.designerInstruction.en).toContain("sample");
  });

  it("a complete answer passes; required parts are asked for", () => {
    const answers = {
      industry: "Restaurant",
      colour_choice: "Designer can suggest suitable colours",
      reference: "No reference: the designer may create a suitable design",
      card_name: "Rahim Uddin",
      card_phone: "01712-345678",
      card_email: "rahim@example.com",
      front_side: ["Logo and brand/company name"],
      card_size: "Standard (3.5 × 2 in)",
      orientation: "Horizontal",
      print_type: "Double-sided",
    };
    expect(cleanAnswers(card, answers).errors).toEqual({});
    const missing = cleanAnswers(card, {}).errors;
    for (const k of ["industry", "colour_choice", "reference", "card_name", "front_side", "card_size", "orientation", "print_type"]) expect(missing[k]).toBe("required");
  });
});

describe("private answers", () => {
  const answers = { card_name: "Rahim Uddin", card_phone: "01712-345678", card_email: "rahim@example.com", office_address: "" };
  it("other designers never get them, only that there is one", () => {
    const v = visibleAnswers(card, answers, false);
    expect(v.answers).toEqual({ card_name: "Rahim Uddin" });
    expect(v.hidden.sort()).toEqual(["card_email", "card_phone"]);
  });
  it("the client, the team and the winner see everything", () => {
    expect(visibleAnswers(card, answers, true)).toEqual({ answers, hidden: [] });
  });
  it("Admin → Services keeps the private tick, only on text, long text and link questions", () => {
    const res = parseService({ ...card, fields: [...card.fields.map((f) => ({ ...f })), { key: "extra", type: "choice", label: { en: "A", bn: "B" }, help: { en: "", bn: "" }, required: false, options: [{ en: "x", bn: "x" }, { en: "y", bn: "y" }], private: true }] }, card);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.service.fields.filter((f) => f.private).map((f) => f.key).sort()).toEqual(["card_email", "card_phone", "office_address", "qr_link"]);
    expect(res.service.fields.length).toBe(BUSINESS_CARD_FIELDS.length + 1);
  });
  it("the contest page strips them on the server, for everyone but the client, the team and the winner", () => {
    const src = readFileSync("src/lib/contests/browse.ts", "utf8");
    expect(src).toContain("visibleAnswers(def, svc.serviceBrief, isOwner || isAdmin || winner)");
  });
});

describe("other contests start like the logo contest (owner, 2026-10-17)", () => {
  const wizard = readFileSync("src/components/services/service-wizard.tsx", "utf8");
  it("a visitor gives name, mobile and email once, on the first step", () => {
    expect(wizard).toContain('const steps: Step[] = user ? ["brief", "order", "pay"] : ["you", "brief", "order", "pay"];');
    expect(wizard).not.toContain("PhoneField");
    expect(wizard).toContain("createAccountAndDraft({ push, name: personName,");
  });
  it("every contest has reference images", () => {
    expect(wizard).toContain("<FilesStep");
    expect(wizard).toContain("currentLogo={false}");
    expect(readFileSync("src/components/services/service-brief.tsx", "utf8")).toContain("data-reference-images");
  });
});

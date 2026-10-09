import { describe, expect, it } from "vitest";
import { canOpenClaim, claimWindowEnds, cleanEvidenceUrls, heldPrizeAvailableAt } from "@/lib/claims/rules";
import { checkAgreement, maskIdNumber, normalizeIdNumber, signatureMatches, validIdNumber } from "@/lib/legal/agreement-rules";
import { LEGAL_BN } from "@/lib/legal/bn";
import { LEGAL_EN } from "@/lib/legal/en";
import { fillLegal, LEGAL_SLUGS } from "@/lib/legal/types";

describe("originality agreement (BLUEPRINT §9.6)", () => {
  it("normalises ID numbers: spaces, dashes, Bangla digits, case", () => {
    expect(normalizeIdNumber("১২৩ ৪৫৬-৭৮৯০")).toBe("1234567890");
    expect(normalizeIdNumber(" a0123 4567 ")).toBe("A01234567");
  });

  it("checks the number per ID type", () => {
    expect(validIdNumber("nid", "1234567890")).toBe(true);
    expect(validIdNumber("nid", "1234567890123")).toBe(true);
    expect(validIdNumber("nid", "12345678901234567")).toBe(true);
    expect(validIdNumber("nid", "12345678901")).toBe(false);
    expect(validIdNumber("birth_certificate", "12345678901234567")).toBe(true);
    expect(validIdNumber("birth_certificate", "1234567890")).toBe(false);
    expect(validIdNumber("passport", "A01234567")).toBe(true);
    expect(validIdNumber("passport", "ABCDEFG")).toBe(false);
    expect(validIdNumber("passport", "A0123456789")).toBe(false);
  });

  it("masks with six dots and the last four, hiding the length", () => {
    expect(maskIdNumber("1234567890")).toBe("••••••7890");
    expect(maskIdNumber("12345678901234567")).toBe("••••••4567");
  });

  it("signature must match the full name, ignoring case and spaces", () => {
    expect(signatureMatches("Nila  Akter", " nila akter ")).toBe(true);
    expect(signatureMatches("Nila Akter", "Nila")).toBe(false);
    expect(signatureMatches("", "")).toBe(false);
  });

  it("cleans a valid form and reports each bad field", () => {
    const ok = checkAgreement({
      fullName: " Nila Akter ",
      mobile: "01712-345678",
      address: "House 5, Road 2, Dhanmondi, Dhaka",
      idType: "nid",
      idNumber: "123 456 7890",
      signature: "nila akter",
      agreed: true,
    });
    expect(ok).toEqual({
      ok: true,
      values: { fullName: "Nila Akter", mobile: "+8801712345678", address: "House 5, Road 2, Dhanmondi, Dhaka", idType: "nid", idNumber: "1234567890", signature: "nila akter" },
    });
    const bad = checkAgreement({ fullName: "Ni", mobile: "123", address: "short", idType: "nid", idNumber: "12", signature: "x", agreed: false });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["address", "agreed", "fullName", "idNumber", "mobile", "signature"]);
    const type = checkAgreement({
      fullName: "Nila Akter",
      mobile: "01712345678",
      address: "House 5, Road 2, Dhaka",
      idType: "driving",
      idNumber: "1234567890",
      signature: "Nila Akter",
      agreed: true,
    });
    expect(type.ok === false && type.errors.idType).toBe(true);
  });
});

describe("copy claims and the payout hold (BLUEPRINT §7.3, §7.6)", () => {
  const picked = new Date("2026-10-01T10:00:00Z");

  it("the window ends N days after the pick", () => {
    expect(claimWindowEnds(picked, 3).toISOString()).toBe("2026-10-04T10:00:00.000Z");
  });

  it("allows a claim only inside the window, on a live or approved handover, with none open", () => {
    const inside = new Date("2026-10-03T10:00:00Z");
    const after = new Date("2026-10-04T10:00:01Z");
    expect(canOpenClaim({ status: "submitted", pickedAt: picked }, inside, 3, false)).toBe(true);
    expect(canOpenClaim({ status: "approved", pickedAt: picked }, inside, 3, false)).toBe(true);
    expect(canOpenClaim({ status: "approved", pickedAt: picked }, after, 3, false)).toBe(false);
    expect(canOpenClaim({ status: "submitted", pickedAt: picked }, inside, 3, true)).toBe(false);
    expect(canOpenClaim({ status: "cancelled", pickedAt: picked }, inside, 3, false)).toBe(false);
    expect(canOpenClaim({ status: "no_result", pickedAt: picked }, inside, 3, false)).toBe(false);
  });

  it("a held prize is available at the end of the hold, or frozen while a claim is open", () => {
    expect(heldPrizeAvailableAt(picked, 3, false)?.toISOString()).toBe("2026-10-04T10:00:00.000Z");
    expect(heldPrizeAvailableAt(picked, 3, true)).toBeNull();
  });

  it("evidence links: adds https, de-duplicates, caps at five, rejects non-links", () => {
    expect(cleanEvidenceUrls(["example.com/logo", "https://example.com/logo", "", "  "])).toEqual(["https://example.com/logo"]);
    expect(cleanEvidenceUrls(["a.com/1", "a.com/2", "a.com/3", "a.com/4", "a.com/5", "a.com/6"])).toHaveLength(5);
    expect(cleanEvidenceUrls(["not a link"])).toBeNull();
    expect(cleanEvidenceUrls(["javascript:alert(1)"])).toBeNull();
  });
});

describe("legal texts (P-10)", () => {
  it("English and Bangla have the same pages and sections", () => {
    for (const slug of LEGAL_SLUGS) {
      expect(LEGAL_BN[slug].sections.map((s) => s.id)).toEqual(LEGAL_EN[slug].sections.map((s) => s.id));
      expect(LEGAL_BN[slug].summary.length).toBe(LEGAL_EN[slug].summary.length);
    }
  });

  it("fills placeholders and leaves unknown ones", () => {
    expect(fillLegal("{claimDays} days, {fee}%, {nope}", { claimDays: 3, fee: 25 })).toBe("3 days, 25%, {nope}");
  });

  it("every placeholder used in the texts is one the page provides", () => {
    const known = new Set([
      "fee",
      "largeFee",
      "largeFrom",
      "judging",
      "upload",
      "response",
      "tiers",
      "withdrawMin",
      "claimDays",
      "repick",
      "minDays",
      "maxDays",
      "perDay",
      "phone",
    ]);
    const all = JSON.stringify([LEGAL_EN, LEGAL_BN]);
    const used = new Set([...all.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
    expect([...used].filter((u) => !known.has(u))).toEqual([]);
  });
});

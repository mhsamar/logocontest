import { describe, expect, it } from "vitest";
import { checkHeadline, sourceRows } from "@/lib/logo-check/present";
import { accessFor, certNumber, checksLeft, isFetchableUrl, isOnHosts, overallScore, parseCertNumber, uniquenessScore, verdictFor } from "@/lib/logo-check/rules";

const limits = { perContest: 3, freeFrom: 8000, price: 500, closeFrom: 45, highRiskFrom: 85 };

describe("AI copyright checker rules (owner, 2026-10-10)", () => {
  it("is free from ৳8,000, paid below that once the add-on is bought, locked otherwise", () => {
    expect(accessFor(8000, false, limits)).toBe("free");
    expect(accessFor(15000, false, limits)).toBe("free");
    expect(accessFor(7999, true, limits)).toBe("paid");
    expect(accessFor(5000, false, limits)).toBe("locked");
  });

  it("counts checks left and never goes below zero", () => {
    expect(checksLeft(0, limits)).toBe(3);
    expect(checksLeft(2, limits)).toBe(1);
    expect(checksLeft(5, limits)).toBe(0);
  });

  it("gives the verdict from the closest found logo", () => {
    expect(verdictFor([], limits)).toBe("no_match");
    expect(verdictFor([10, 44], limits)).toBe("no_match");
    expect(verdictFor([45, 20], limits)).toBe("similar");
    expect(verdictFor([62, 85], limits)).toBe("high_risk");
  });

  it("scores uniqueness and overall between 0 and 100", () => {
    expect(uniquenessScore(62)).toBe(38);
    expect(uniquenessScore(120)).toBe(0);
    expect(overallScore(38, 90, 80)).toBe(62);
    expect(overallScore(100, 100, 100)).toBe(100);
  });

  it("formats and reads certificate numbers", () => {
    expect(certNumber(3)).toBe("CC-0003");
    expect(certNumber(12345)).toBe("CC-12345");
    expect(parseCertNumber("CC-0003")).toBe(3);
    expect(parseCertNumber("cc3")).toBe(3);
    expect(parseCertNumber("CC-0000")).toBeNull();
    expect(parseCertNumber("LC-0003")).toBeNull();
  });

  it("drops results on our own site or the client's site", () => {
    expect(isOnHosts("https://www.logocontest.bd/contest/x", ["logocontest.bd"])).toBe(true);
    expect(isOnHosts("https://shop.client.com/about", ["client.com"])).toBe(true);
    expect(isOnHosts("https://notclient.com", ["client.com"])).toBe(false);
  });

  it("only fetches https links on public hosts", () => {
    expect(isFetchableUrl("https://cdn.example.com/a.png")).toBe(true);
    expect(isFetchableUrl("http://cdn.example.com/a.png")).toBe(false);
    expect(isFetchableUrl("https://localhost/a.png")).toBe(false);
    expect(isFetchableUrl("https://192.168.1.4/a.png")).toBe(false);
    expect(isFetchableUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isFetchableUrl("https://[::1]/x")).toBe(false);
  });
});

const src = (lens: boolean, vision: boolean) => ({
  lens: { ran: lens, found: 9 },
  vision: { ran: vision, found: 2 },
  site: { ran: true, found: 6, close: 0 },
  shape: { compared: 14, close: 2, closest: 62 },
  font: { look: "bold sans", guess: "Montserrat", hasText: true },
});

describe("AI copyright checker wording (owner, 2026-10-10)", () => {
  it("names Google Lens only when Google Lens really ran", () => {
    expect(sourceRows(src(false, true)).map((r) => r.label)).not.toContain("Google Lens image search");
    expect(sourceRows(src(true, false)).map((r) => r.label)).toEqual(["Google Lens image search", "Logos on logocontest.bd", "Shape match by AI", "Font check"]);
  });

  it("says 'looks like' about the font, never as a fact", () => {
    expect(sourceRows(src(true, true)).at(-1)?.found).toBe("Looks like Montserrat");
  });

  it("writes the headline from the verdict", () => {
    expect(checkHeadline("similar", src(true, true), { highRiskFrom: 85 }).headline).toBe("2 similar logos found");
    expect(checkHeadline("no_match", { ...src(true, true), shape: { compared: 0, close: 0, closest: 0 } }, { highRiskFrom: 85 }).subline).toMatch(/Nothing similar/);
  });
});

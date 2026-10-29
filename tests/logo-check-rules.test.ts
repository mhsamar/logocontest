import { describe, expect, it } from "vitest";
import { checkHeadline, sourceRows } from "@/lib/logo-check/present";
import { accessFor, certNumber, checksLeft, limitFor, isFetchableUrl, isOnHosts, logoCropBox, overallScore, parseCertNumber, uniquenessScore, verdictFor } from "@/lib/logo-check/rules";

const limits = { freeChecks: 10, paidChecks: 10, freeFrom: 5000, price: 250, closeFrom: 45, highRiskFrom: 85 };

describe("AI copyright checker rules (owner, 2026-10-10)", () => {
  it("is free on every logo contest, with no add-on (owner, 2026-10-14)", () => {
    expect(accessFor(1000, false, limits)).toBe("free");
    expect(accessFor(3000, false, limits)).toBe("free");
    expect(accessFor(15000, true, limits)).toBe("free");
  });

  it("gives every logo contest the same checks, whatever the prize (owner, 2026-10-29: 10), from Settings", () => {
    expect(limitFor(false, limits)).toBe(10);
    expect(limitFor(false, { ...limits, freeChecks: 12 })).toBe(12);
  });

  it("a contest that bought the old add-on keeps at least the checks it paid for", () => {
    expect(limitFor(true, { ...limits, freeChecks: 5 })).toBe(10);
    expect(limitFor(true, limits)).toBe(10);
  });

  it("counts checks left and never goes below zero", () => {
    expect(checksLeft(0, limitFor(false, limits))).toBe(10);
    expect(checksLeft(7, limitFor(false, limits))).toBe(3);
    expect(checksLeft(12, limitFor(false, limits))).toBe(0);
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

describe("logoCropBox (owner, 2026-10-16: check only the logo inside a mockup)", () => {
  it("cuts the AI's box out of the picture, with a little room around it", () => {
    expect(logoCropBox([400, 300, 600, 700], 1000, 1000)).toEqual({ left: 260, top: 360, width: 480, height: 280 });
  });
  it("keeps the whole picture when the box is unusable, tiny or almost everything", () => {
    expect(logoCropBox(null, 1000, 1000)).toBeNull();
    expect(logoCropBox([1, 2, 3], 1000, 1000)).toBeNull();
    expect(logoCropBox([600, 300, 400, 700], 1000, 1000)).toBeNull();
    expect(logoCropBox([500, 500, 510, 510], 1000, 1000)).toBeNull();
    expect(logoCropBox([0, 0, 1000, 1000], 1000, 1000)).toBeNull();
  });
  it("stays inside the picture", () => {
    const r = logoCropBox([0, 0, 500, 500], 800, 600)!;
    expect(r.left).toBe(0);
    expect(r.top).toBe(0);
    expect(r.left + r.width).toBeLessThanOrEqual(800);
    expect(r.top + r.height).toBeLessThanOrEqual(600);
  });
});

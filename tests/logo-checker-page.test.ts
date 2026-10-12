import { describe, expect, it } from "vitest";
import { isNewLink, LISTS } from "@/lib/content/list-defs";
import { pctColour, radarRadius, radarSpot } from "@/lib/logo-checker/samples";

describe("Logo Checker page (owner, 2026-10-13)", () => {
  it("is in the main menu after Design Studio and in the footer for clients", () => {
    const menu = LISTS.header_menu.builtIn.map((b) => b.href);
    expect(menu.indexOf("/logo-checker")).toBe(menu.indexOf("/design-studio") + 1);
    expect(menu.length).toBeLessThanOrEqual(LISTS.header_menu.max);
    expect(LISTS.footer_links.builtIn.find((b) => b.href === "/logo-checker")?.column).toBe("clients");
  });

  it("shows the NEW pill for about 30 days, then drops it on its own", () => {
    expect(isNewLink("/logo-checker", new Date("2026-10-13T12:00:00+06:00"))).toBe(true);
    expect(isNewLink("/logo-checker", new Date("2026-11-11T23:59:00+06:00"))).toBe(true);
    expect(isNewLink("/logo-checker", new Date("2026-11-12T00:00:00+06:00"))).toBe(false);
    expect(isNewLink("/design-studio", new Date("2026-10-13T12:00:00+06:00"))).toBe(false);
    expect(isNewLink(undefined, new Date())).toBe(false);
  });

  it("puts closer logos nearer the radar's centre, on the 75/50/25% rings", () => {
    expect(radarRadius(75)).toBeCloseTo(15.5);
    expect(radarRadius(50)).toBeCloseTo(27);
    expect(radarRadius(25)).toBeCloseTo(38.5);
    expect(radarRadius(86)).toBeLessThan(radarRadius(15));
    expect(radarSpot(50, 0)).toEqual({ left: 77, top: 50 });
  });

  it("colours a similarity red when close, orange in between, green when far", () => {
    expect([pctColour(84), pctColour(41), pctColour(22)]).toEqual(["#C0161F", "#D9480F", "#1F9D57"]);
  });
});

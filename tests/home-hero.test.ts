import { describe, expect, it } from "vitest";
import { BUILT_IN_SLIDES, builtInImage, colorsFrom, imageFromPath, isHexColor, logoSizes, photoPosition, shade } from "@/lib/home/hero-slides";

describe("home hero slides (owner, 2026-10-11)", () => {
  it("sizes a logo by its shape: wide logos wider, tall ones narrower, always inside the product", () => {
    const wide = logoSizes(420, 172, "bag");
    const tall = logoSizes(334, 480, "cup");
    const square = logoSizes(400, 400, "phone");
    expect(wide.card).toBeGreaterThan(square.card);
    expect(tall.card).toBeLessThan(square.card);
    expect(tall.item).toBeLessThanOrEqual(10); // the cup is narrow
    expect(logoSizes(4000, 10, "phone").item).toBeLessThanOrEqual(14);
    expect(logoSizes(10, 4000, "ticket").badge).toBeGreaterThanOrEqual(8);
  });

  it("suggests slide colours from a logo colour", () => {
    const c = colorsFrom("#e52d54");
    expect(c.main).toBe("#E52D54");
    expect(Object.values(c).every(isHexColor)).toBe(true);
    expect(shade("#808080", 1)).toBe("#FFFFFF");
    expect(shade("#808080", -1)).toBe("#000000");
    expect(colorsFrom("not a colour").main).toBe("#8B0000");
  });

  it("knows the size of a stored picture from its path", () => {
    expect(imageFromPath("hero-slides/0b0e8c2e-1111-4222-8333-944445555666-648x688.jpg")).toEqual({ width: 648, height: 688 });
    expect(imageFromPath("/home-hero/beep-logo.png")).toEqual({ width: 420, height: 172 });
    expect(imageFromPath("/home-hero/../secrets.png")).toBeNull();
    expect(imageFromPath("hero-slides/tmp/0b0e8c2e-1111-4222-8333-944445555666.png")).toBeNull();
    expect(imageFromPath("https://evil.example/x.png")).toBeNull();
    expect(builtInImage(BUILT_IN_SLIDES[0].photo.src)).not.toBeNull();
  });

  it("keeps the photo's chosen part in view", () => {
    expect(photoPosition(25)).toBe("50% 25%");
    expect(photoPosition(-5)).toBe("50% 0%");
    expect(photoPosition(140)).toBe("50% 100%");
  });

  it("has four built-in sample slides, each with its three pictures", () => {
    expect(BUILT_IN_SLIDES).toHaveLength(4);
    for (const s of BUILT_IN_SLIDES) for (const p of [s.photo, s.logo, s.logoWhite]) expect(p.src.startsWith("/home-hero/")).toBe(true);
  });
});

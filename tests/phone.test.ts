import { describe, expect, it } from "vitest";
import { countryOfMobile, flagOf, formatBdMobile, formatMobile, maskBdMobile, nationalPart, normalizeBdMobile, toAsciiDigits, toE164 } from "@/lib/phone";

describe("normalizeBdMobile", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["01712-345678", "+8801712345678"],
    ["017 1234 5678", "+8801712345678"],
    ["+8801712345678", "+8801712345678"],
    ["8801712345678", "+8801712345678"],
    ["008801712345678", "+8801712345678"],
    ["1712345678", "+8801712345678"],
    ["০১৭১২৩৪৫৬৭৮", "+8801712345678"],
    ["+৮৮০১৯১২৩৪৫৬৭৮", "+8801912345678"],
    ["01312345678", "+8801312345678"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeBdMobile(input)).toBe(expected);
  });

  it.each([
    "",
    "0171234567", // too short
    "017123456789", // too long
    "01212345678", // 012 is not a mobile prefix
    "02123456789", // landline
    "+447700900123", // not Bangladesh
    "abc",
    "0171234567x",
  ])("rejects %s", (input) => {
    expect(normalizeBdMobile(input)).toBeNull();
  });
});

describe("formatting", () => {
  it("converts Bangla digits", () => {
    expect(toAsciiDigits("০১২৩৪৫৬৭৮৯")).toBe("0123456789");
  });

  it("formats and masks", () => {
    expect(formatBdMobile("+8801712345678")).toBe("01712-345678");
    expect(maskBdMobile("+8801712345678")).toBe("01712-•••678");
  });
});

describe("mobiles from any country (owner, 2026-10-14)", () => {
  it("Bangladesh stays the default and keeps its strict rule", () => {
    expect(toE164("01712-345678")).toBe("+8801712345678");
    expect(toE164("01712-345678", "BD")).toBe("+8801712345678");
    expect(toE164("+880 1712 345678", "GB")).toBe("+8801712345678");
    expect(toE164("01212345678")).toBeNull();
  });

  it("other countries: the national number with its code, a leading 0 dropped", () => {
    expect(toE164("07911 123456", "GB")).toBe("+447911123456");
    expect(toE164("98765 43210", "IN")).toBe("+919876543210");
    expect(toE164("050 123 4567", "AE")).toBe("+971501234567");
    expect(toE164("+1 (415) 555-0123", "BD")).toBe("+14155550123");
    expect(toE164("0044 7911 123456")).toBe("+447911123456");
    expect(toE164("12", "GB")).toBeNull();
    expect(toE164("abc", "GB")).toBeNull();
  });

  it("country, formatting and the national part of a stored number", () => {
    expect(countryOfMobile("+447911123456")).toBe("GB");
    expect(countryOfMobile("+14155550123")).toBe("US");
    expect(countryOfMobile("+8801712345678")).toBe("BD");
    expect(formatMobile("+8801712345678")).toBe("01712-345678");
    expect(formatMobile("+971501234567")).toBe("+971 501234567");
    expect(nationalPart("+447911123456")).toEqual({ country: "GB", number: "7911123456" });
    expect(nationalPart("+8801712345678")).toEqual({ country: "BD", number: "01712345678" });
    expect(flagOf("BD")).toBe("🇧🇩");
  });
});

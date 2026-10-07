import { describe, expect, it } from "vitest";
import { formatBdMobile, maskBdMobile, normalizeBdMobile, toAsciiDigits } from "@/lib/phone";

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

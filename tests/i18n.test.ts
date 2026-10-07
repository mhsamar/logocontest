import { describe, expect, it } from "vitest";
import bn from "@/lib/i18n/messages/bn";
import en from "@/lib/i18n/messages/en";
import { createTranslator } from "@/lib/i18n/translate";

function flatten(obj: object, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? { ...acc, [key]: v } : { ...acc, ...flatten(v, key) };
  }, {});
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  const flatEn = flatten(en);
  const flatBn = flatten(bn);

  it("bn has exactly the same keys as en", () => {
    expect(Object.keys(flatBn).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it("no string is empty", () => {
    for (const [key, value] of Object.entries({ ...flatEn, ...flatBn })) expect(value.trim(), key).not.toBe("");
  });

  it("bn uses the same placeholders as en", () => {
    for (const key of Object.keys(flatEn)) expect(placeholders(flatBn[key]), key).toEqual(placeholders(flatEn[key]));
  });

  it("interpolates params and shows numbers in Bangla digits for bn", () => {
    expect(createTranslator("en", en)("auth.errors.cooldown", { seconds: 42 })).toBe(
      "Please wait 42 seconds before asking for a new code.",
    );
    expect(createTranslator("bn", bn)("auth.errors.cooldown", { seconds: 42 })).toBe(
      "নতুন কোড চাওয়ার আগে ৪২ সেকেন্ড অপেক্ষা করুন।",
    );
    // Strings (like an OTP code) are left as written.
    expect(createTranslator("bn", bn)("auth.sms.register", { code: "123456", minutes: 5 })).toContain("123456");
  });
});

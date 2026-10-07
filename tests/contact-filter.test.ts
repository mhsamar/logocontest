import { describe, expect, it } from "vitest";
import { findContactDetails } from "@/lib/moderation/contact-filter";

describe("findContactDetails (no-contact filter)", () => {
  it("lets normal comments through", () => {
    for (const ok of [
      "Nice designs, good job!",
      "Entry 12 looks copied from another contest, please check.",
      "অসাধারণ ডিজাইন, ধন্যবাদ",
      "I like the 2nd and 3rd ideas. Prize is 5000 taka.",
      "Please make the at symbol bigger? no, the A letter",
    ]) {
      expect(findContactDetails(ok), ok).toBeNull();
    }
  });

  it("catches Bangladeshi mobile numbers, split or in Bangla digits", () => {
    expect(findContactDetails("call 01712028511")).toBe("phone");
    expect(findContactDetails("017-1202 85.11")).toBe("phone");
    expect(findContactDetails("+880 1712 028511")).toBe("phone");
    expect(findContactDetails("০১৭১২০২৮৫১১ এ কল করুন")).toBe("phone");
  });

  it("catches numbers spelled out", () => {
    expect(findContactDetails("zero one seven one two zero")).toBe("number_words");
    expect(findContactDetails("shunno ek sat ek dui shunno")).toBe("number_words");
    expect(findContactDetails("শূন্য এক সাত এক দুই শূন্য")).toBe("number_words");
  });

  it("catches emails and links", () => {
    expect(findContactDetails("mail me a@b.com")).toBe("email");
    expect(findContactDetails("my gmail is sam")).toBe("email");
    expect(findContactDetails("see www.example.org")).toBe("link");
    expect(findContactDetails("mysite dot com")).toBe("link");
    expect(findContactDetails("knock me on WhatsApp")).toBe("link");
    expect(findContactDetails("fb te knock dio")).toBe("link");
    expect(findContactDetails("example.com.bd")).toBe("link");
  });

  it("checks the admin's extra blocked terms", () => {
    expect(findContactDetails("find me on secretapp", ["SecretApp"])).toBe("term");
  });
});

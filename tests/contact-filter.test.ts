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

  it("lets ordinary brief text through, even when it names a platform (owner, 2026-10-08)", () => {
    for (const ok of [
      "Young families in Dhaka, aged 25–40, who shop on Facebook",
      "We sell homemade pickles in Dhaka, mostly through our Facebook page.",
      "It should not look like Instagram's logo.",
      "Office workers aged 25 to 45 who order on WhatsApp groups and Facebook.",
      "আমরা ফেসবুকে বিক্রি করি, ক্রেতারা ২৫–৪০ বছর বয়সী।",
      "Founded in 2019, prices from 150 to 900 taka.",
      "We are on logocontest.bd",
    ]) {
      expect(findContactDetails(ok), ok).toBeNull();
    }
  });

  it("still blocks real contact details (owner, 2026-10-08)", () => {
    expect(findContactDetails("call +8801677713493")).toBe("phone");
    expect(findContactDetails("my number 01677713493")).toBe("phone");
    expect(findContactDetails("write to rafi@gmail.com")).toBe("email");
    expect(findContactDetails("rafi @gmail.com")).toBe("email");
    expect(findContactDetails("contact me on my facebook ID")).toBe("link");
    expect(findContactDetails("WhatsApp: rafi designs")).toBe("link");
    expect(findContactDetails("inbox me on fb")).toBe("link");
    expect(findContactDetails("ফেসবুক আইডি দিন")).toBe("link");
    expect(findContactDetails("follow @rafi_designs")).toBe("handle");
    expect(findContactDetails("facebook.com/rafi")).toBe("link");
  });

  it("checks the admin's extra blocked terms", () => {
    expect(findContactDetails("find me on secretapp", ["SecretApp"])).toBe("term");
  });
});

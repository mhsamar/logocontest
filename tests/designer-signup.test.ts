import { describe, expect, it } from "vitest";
import { checkPayout, checkUsernameFormat, suggestUsername } from "@/lib/designers/signup";

describe("checkUsernameFormat", () => {
  it("accepts and lower-cases good usernames", () => {
    expect(checkUsernameFormat("  Rafi_Designs ")).toEqual({ ok: true, username: "rafi_designs" });
    expect(checkUsernameFormat("abc")).toEqual({ ok: true, username: "abc" });
  });

  it("rejects bad ones with a reason", () => {
    expect(checkUsernameFormat("ab")).toEqual({ ok: false, error: "short" });
    expect(checkUsernameFormat("a".repeat(21))).toEqual({ ok: false, error: "long" });
    expect(checkUsernameFormat("rafi-designs")).toEqual({ ok: false, error: "format" });
    expect(checkUsernameFormat("9rafi")).toEqual({ ok: false, error: "format" });
    expect(checkUsernameFormat("রাফি")).toEqual({ ok: false, error: "format" });
    expect(checkUsernameFormat("Admin")).toEqual({ ok: false, error: "reserved" });
    expect(checkUsernameFormat("logo_contest")).toEqual({ ok: false, error: "reserved" });
  });
});

describe("suggestUsername", () => {
  it("builds one from the name", () => {
    expect(suggestUsername("Rafi Ahmed")).toBe("rafi_ahmed");
    expect(suggestUsername("  M. H. Samar ")).toBe("m_h_samar");
    expect(suggestUsername("রাফি")).toBe("");
  });
});

describe("checkPayout", () => {
  it("accepts a bKash number in any common format", () => {
    expect(checkPayout({ type: "bkash", bkashNumber: "01712-028511" })).toEqual({ ok: true, payout: { type: "bkash", bkash_number: "+8801712028511" } });
    expect(checkPayout({ type: "bkash", bkashNumber: "12345" })).toEqual({ ok: false, field: "bkashNumber" });
  });

  it("checks bank details, with branch and routing optional", () => {
    const bank = { type: "bank" as const, bankName: "Dutch-Bangla Bank", branch: "", accountName: "Rafi Ahmed", accountNumber: "123 4567 890", routingNumber: "" };
    expect(checkPayout(bank)).toEqual({
      ok: true,
      payout: { type: "bank", bank_name: "Dutch-Bangla Bank", branch: null, account_name: "Rafi Ahmed", account_number: "1234567890", routing_number: null },
    });
    expect(checkPayout({ ...bank, accountNumber: "12ab" })).toEqual({ ok: false, field: "accountNumber" });
    expect(checkPayout({ ...bank, routingNumber: "123" })).toEqual({ ok: false, field: "routingNumber" });
    expect(checkPayout({ ...bank, bankName: " " })).toEqual({ ok: false, field: "bankName" });
  });
});

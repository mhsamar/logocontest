import { describe, expect, it } from "vitest";
import { emailProblem, inDomainList, parseDomainList } from "@/lib/auth/email-rules";

describe("real emails only (owner, 2026-10-14)", () => {
  it("accepts normal addresses", () => {
    expect(emailProblem("rahim.uddin@gmail.com")).toBeNull();
    expect(emailProblem("karim2024@yahoo.com")).toBeNull();
    expect(emailProblem("info@womiras.com")).toBeNull();
    expect(emailProblem("de@studio.com.bd")).toBeNull();
    expect(emailProblem("sabbir+logos@gmail.com")).toBeNull();
  });

  it("made-up Gmail and Yahoo names are refused", () => {
    expect(emailProblem("de@gmail.com")).toEqual({ kind: "fake" });
    expect(emailProblem("d.e.f@gmail.com")).toEqual({ kind: "fake" });
    expect(emailProblem("abc@yahoo.com")).toEqual({ kind: "fake" });
    expect(emailProblem("email@gmail.com")).toEqual({ kind: "fake" });
    expect(emailProblem("rahim_uddin@gmail.com")).toEqual({ kind: "fake" });
  });

  it("placeholder names and domains are refused anywhere", () => {
    expect(emailProblem("xyz@company.org")).toEqual({ kind: "fake" });
    expect(emailProblem("test@brand.com")).toEqual({ kind: "fake" });
    expect(emailProblem("aaaa@brand.com")).toEqual({ kind: "fake" });
    expect(emailProblem("rahim@example.com")).toEqual({ kind: "fake" });
  });

  it("temporary inboxes are refused, including the owner's extra list", () => {
    expect(emailProblem("hewoti9982@backyr.com")).toEqual({ kind: "disposable" });
    expect(emailProblem("someone@mailinator.com")).toEqual({ kind: "disposable" });
    expect(emailProblem("someone@inbox.mailinator.com")).toEqual({ kind: "disposable" });
    expect(emailProblem("someone@newtemp.xyz", { blocked: parseDomainList("@newtemp.xyz, other.io") })).toEqual({ kind: "disposable" });
    expect(emailProblem("someone@newtemp.xyz", { allowed: parseDomainList("newtemp.xyz"), blocked: parseDomainList("newtemp.xyz") })).toBeNull();
  });

  it("common misspellings suggest the right provider", () => {
    expect(emailProblem("rahim.uddin@gmial.com")).toEqual({ kind: "typo", suggestion: "rahim.uddin@gmail.com" });
    expect(emailProblem("karim2024@yahoo.co")).toEqual({ kind: "typo", suggestion: "karim2024@yahoo.com" });
  });

  it("domain lists: one per line or comma separated; sub-domains count", () => {
    expect([...parseDomainList("a.com\n b.org , @c.net; not a domain")]).toEqual(["a.com", "b.org", "c.net"]);
    expect(inDomainList("mx.a.com", new Set(["a.com"]))).toBe(true);
    expect(inDomainList("a.com.bd", new Set(["a.com"]))).toBe(false);
  });
});

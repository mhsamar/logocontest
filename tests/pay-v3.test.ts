import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanTrx, cueAt, helpMessage, voicePlayedKey } from "@/components/pay-v3/rules";
import { BANKS, isBankRef, isProofMethod, normalizeBankRef, payReference } from "@/lib/payments/manual-rules";
import { SETTINGS } from "@/lib/settings/registry";

/** The contest payment flow (owner, 2026-11-06; Design/logocontest-update PayV3, PayTrx, PayBank, PayWait). */
describe("contest payment flow", () => {
  it("the reference is LC and the contest number", () => {
    expect(payReference(1042)).toBe("LC1042");
    expect(payReference(null)).toBeNull();
  });

  it("a TrxID typed, pasted, or inside a whole SMS", () => {
    expect(cleanTrx("9k7x 2pq1ab")).toBe("9K7X2PQ1AB");
    expect(cleanTrx("Send Money Tk 6,250.00 to 01712 successful. TrxID 9K7X2PQ1AB at 06/11/2026")).toBe("9K7X2PQ1AB");
  });

  it("a bank receipt's number can be longer than a TrxID", () => {
    expect(normalizeBankRef("ft-2611 068842")).toBe("FT2611068842");
    expect(isBankRef("FT2611068842")).toBe(true);
    expect(isBankRef("12345")).toBe(false);
    expect(BANKS.length).toBeGreaterThan(10);
    expect(["bkash", "bank", "other"].every(isProofMethod)).toBe(true);
    expect(isProofMethod("card")).toBe(false);
  });

  it("the voice guide's line follows the audio's own clock", () => {
    const cues = SETTINGS["pay.voice_cues"].default;
    expect(cueAt(cues, 0)?.box).toBe("none");
    expect(cueAt(cues, 6)?.box).toBe("bkash-number");
    expect(cueAt(cues, 11)?.box).toBe("amount");
    expect(cueAt(cues, 34.9)?.box).toBe("whatsapp");
    expect(cueAt(cues, 40)).toBeNull();
    expect(voicePlayedKey("c1")).toBe("lc_voice_played:c1");
    expect(helpMessage("Help", "LC7")).toBe("Help (LC7)");
  });

  it("the owner's seven default lines, and the schema refuses a line ending before it starts only in the action", () => {
    expect(SETTINGS["pay.voice_cues"].default).toHaveLength(7);
    expect(SETTINGS["pay.voice_path"].schema.safeParse("voice/0d0c6e3e-5b1a-4a8e-9a55-7c1c1d1e1f10.mp3").success).toBe(true);
    expect(SETTINGS["pay.voice_path"].schema.safeParse("hero/x.mp3").success).toBe(false);
    expect(readFileSync("src/lib/payments/pay-page-actions.ts", "utf8")).toContain("parsed.data.some((r) => r.to <= r.from)");
  });

  it("the two WhatsApp/SMS promises the owner dropped are not on the screens", () => {
    const bn = readFileSync("src/lib/i18n/messages/bn.ts", "utf8");
    expect(bn).not.toContain("WhatsApp-এ পেমেন্টের লিংক পাঠিয়ে দেবো");
    expect(bn).not.toContain("লাইভ হলেই WhatsApp ও SMS-এ জানাবো");
  });
});

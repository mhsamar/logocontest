import { describe, expect, it } from "vitest";
import { GoogleVisionModerator, safeSearchVerdict } from "@/lib/moderation/images";

describe("safeSearchVerdict", () => {
  it("refuses likely adult and very likely racy photos", () => {
    expect(safeSearchVerdict({ adult: "VERY_LIKELY", racy: "VERY_LIKELY" })).toEqual({ allowed: false, reason: "adult" });
    expect(safeSearchVerdict({ adult: "LIKELY", racy: "POSSIBLE" })).toEqual({ allowed: false, reason: "adult" });
    expect(safeSearchVerdict({ adult: "UNLIKELY", racy: "VERY_LIKELY" })).toEqual({ allowed: false, reason: "racy" });
  });

  it("allows normal photos", () => {
    expect(safeSearchVerdict({ adult: "VERY_UNLIKELY", racy: "POSSIBLE" })).toEqual({ allowed: true });
    expect(safeSearchVerdict({ adult: "POSSIBLE", racy: "LIKELY" })).toEqual({ allowed: true });
  });

  it("refuses when there is no answer", () => {
    expect(safeSearchVerdict(undefined)).toEqual({ allowed: false, reason: "error" });
  });
});

describe("GoogleVisionModerator", () => {
  const reply = (body: unknown, ok = true) => (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

  it("reads the SafeSearch annotation", async () => {
    const m = new GoogleVisionModerator("k", reply({ responses: [{ safeSearchAnnotation: { adult: "VERY_LIKELY", racy: "LIKELY" } }] }));
    expect(await m.check(new Uint8Array([1, 2, 3]))).toEqual({ allowed: false, reason: "adult" });
  });

  it("fails closed when the API errors", async () => {
    const m = new GoogleVisionModerator("k", reply({}, false));
    expect(await m.check(new Uint8Array([1]))).toEqual({ allowed: false, reason: "error" });
  });
});

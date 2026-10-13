import { describe, expect, it } from "vitest";
import { FakeGateway } from "@/lib/payments/fake-gateway";
import { callbackMatches } from "@/lib/pro/rules";

// The Pro payment callback goes through the same signed gateway check as contest payments, then only applies to a
// pending payment of the same amount (owner, 2026-10-13: Designer Pro plan).
describe("Pro payment webhook", () => {
  const gw = new FakeGateway("test-secret");
  const id = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

  it("accepts a correctly signed callback", async () => {
    const v = await gw.verifyCallback(gw.callbackFields(id, 500, "paid"));
    expect(v).toMatchObject({ paymentId: id, status: "paid", amount: 500 });
    expect(callbackMatches({ status: "pending", amount: 500 }, v!)).toBe("ok");
  });

  it("rejects a tampered amount, status or signature", async () => {
    const fields = gw.callbackFields(id, 500, "paid");
    expect(await gw.verifyCallback({ ...fields, amount: "5" })).toBeNull();
    expect(await gw.verifyCallback({ ...gw.callbackFields(id, 500, "failed"), status: "paid" })).toBeNull();
    expect(await gw.verifyCallback({ ...fields, sig: "0".repeat(64) })).toBeNull();
    expect(await new FakeGateway("another-secret").verifyCallback(fields)).toBeNull();
  });

  it("never gives Pro twice for the same payment", async () => {
    const v = await gw.verifyCallback(gw.callbackFields(id, 500, "paid"));
    expect(callbackMatches({ status: "paid", amount: 500 }, v!)).toBe("already");
  });
});

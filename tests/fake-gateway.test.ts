import { describe, expect, it } from "vitest";
import { FakeGateway } from "@/lib/payments/fake-gateway";

const gw = new FakeGateway("secret");
const ID = "11111111-2222-4333-8444-555555555555";

describe("FakeGateway", () => {
  it("signs its checkout link and accepts only the genuine one", async () => {
    const { redirectUrl } = await gw.createCheckout({ paymentId: ID, amount: 6000, method: "bkash", description: "x", customer: { name: "a", mobile: "b" } });
    const url = new URL(redirectUrl, "http://localhost");
    const sig = url.searchParams.get("sig")!;
    expect(gw.checkCheckoutLink(ID, "6000", "bkash", sig)).toBe(true);
    expect(gw.checkCheckoutLink(ID, "60", "bkash", sig)).toBe(false);
    expect(gw.checkCheckoutLink(ID, "6000", "bkash", undefined)).toBe(false);
  });

  it("verifies callbacks and rejects edits or another key", async () => {
    const fields = gw.callbackFields(ID, 6000, "paid");
    expect(await gw.verifyCallback(fields)).toMatchObject({ paymentId: ID, status: "paid", amount: 6000 });
    expect(await gw.verifyCallback({ ...fields, payment_id: "other" })).toBeNull();
    expect(await gw.verifyCallback({ ...fields, sig: "0".repeat(64) })).toBeNull();
    expect(await new FakeGateway("other-secret").verifyCallback(fields)).toBeNull();
    expect(await gw.verifyCallback({})).toBeNull();
  });
});

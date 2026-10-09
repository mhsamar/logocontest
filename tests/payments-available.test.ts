import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("payments available (live site before SSLCommerz)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is true for the test checkout in development", async () => {
    vi.stubEnv("PAYMENT_DRIVER", "fake");
    vi.stubEnv("APP_SECRET", "x".repeat(32));
    const { paymentsAvailable } = await import("@/lib/payments");
    expect(paymentsAvailable()).toBe(true);
  });

  it("is false on the live site with no real gateway, instead of crashing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENT_DRIVER", "fake");
    const { paymentsAvailable } = await import("@/lib/payments");
    expect(paymentsAvailable()).toBe(false);
  });

  it("is false for an unknown driver", async () => {
    vi.stubEnv("PAYMENT_DRIVER", "sslcommerz-not-built-yet");
    const { paymentsAvailable } = await import("@/lib/payments");
    expect(paymentsAvailable()).toBe(false);
  });
});

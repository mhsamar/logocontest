import "server-only";
import { requireEnv } from "@/lib/env";
import { FakeGateway } from "./fake-gateway";
import type { PaymentGateway } from "./gateway";

export type { PaymentGateway };

export function paymentDriver(): string {
  return process.env.PAYMENT_DRIVER ?? "fake";
}

export function getPaymentGateway(): PaymentGateway {
  const driver = paymentDriver();
  switch (driver) {
    case "fake":
      if (process.env.NODE_ENV === "production") throw new Error("PAYMENT_DRIVER=fake is not allowed in production");
      return new FakeGateway(requireEnv("APP_SECRET"));
    default:
      throw new Error(`Unknown PAYMENT_DRIVER "${driver}". SSLCommerz is added in milestone 9.`);
  }
}

export function getFakeGateway(): FakeGateway | null {
  const gateway = paymentDriver() === "fake" && process.env.NODE_ENV !== "production" ? getPaymentGateway() : null;
  return gateway instanceof FakeGateway ? gateway : null;
}

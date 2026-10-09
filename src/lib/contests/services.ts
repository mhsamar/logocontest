import "server-only";
import { getPaymentGateway, type PaymentGateway } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPricingConfig } from "./pricing-config";
import { ContestService } from "./service";
import { SupabaseContestRepository } from "./supabase-repository";

export function contestRepository() {
  return new SupabaseContestRepository(createAdminClient());
}

/**
 * The gateway is only created when a payment actually needs it, so drafts and sign-ups keep working
 * on a live site whose payment gateway isn't set yet.
 */
const lazyGateway: PaymentGateway = {
  get name() {
    return getPaymentGateway().name;
  },
  createCheckout: (input) => getPaymentGateway().createCheckout(input),
  verifyCallback: (params) => getPaymentGateway().verifyCallback(params),
};

export function contestService() {
  return new ContestService({
    repo: contestRepository(),
    pricing: getPricingConfig,
    gateway: lazyGateway,
  });
}

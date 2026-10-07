import "server-only";
import { getPaymentGateway } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPricingConfig } from "./pricing-config";
import { ContestService } from "./service";
import { SupabaseContestRepository } from "./supabase-repository";

export function contestRepository() {
  return new SupabaseContestRepository(createAdminClient());
}

export function contestService() {
  return new ContestService({
    repo: contestRepository(),
    pricing: getPricingConfig,
    gateway: getPaymentGateway(),
  });
}

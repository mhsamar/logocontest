import type { Metadata } from "next";
import { LandingPage, landingMetadata } from "@/components/seo/landing-page";
import { content } from "@/lib/landing/content/logo-design-price";

// Logo design price in Bangladesh (owner, 2026-10-21; SEO-PLAN.md B1): live package totals in taka, with the fee.
export async function generateMetadata(): Promise<Metadata> {
  return landingMetadata(content);
}

export default function LogoDesignPricePage() {
  return <LandingPage content={content} offers />;
}

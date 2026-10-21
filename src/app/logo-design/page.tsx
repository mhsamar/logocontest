import type { Metadata } from "next";
import { LandingPage, landingMetadata } from "@/components/seo/landing-page";
import { content } from "@/lib/landing/content/logo-design";

// Logo design service in Bangladesh (owner, 2026-10-21; SEO-PLAN.md B3): a contest compared honestly with the others.
export async function generateMetadata(): Promise<Metadata> {
  return landingMetadata(content);
}

export default function LogoDesignPage() {
  return <LandingPage content={content} offers />;
}

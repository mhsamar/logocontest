import type { Metadata } from "next";
import { LandingPage, landingMetadata } from "@/components/seo/landing-page";
import { content } from "@/lib/landing/content/about";

// About logocontest.bd (owner, 2026-10-21; SEO-PLAN.md B2): who we are, without invented facts.
export async function generateMetadata(): Promise<Metadata> {
  return landingMetadata(content);
}

export default function AboutPage() {
  return <LandingPage content={content} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPage, landingMetadata } from "@/components/seo/landing-page";
import { getI18n } from "@/lib/i18n/server";
import { INDUSTRY_CONTENT } from "@/lib/landing/content/industries";
import { industryOf } from "@/lib/landing/industries";
import { industryExamples } from "@/lib/landing/industry-examples";

// Logo design by business (owner, 2026-11-03): /logo-design/restaurant and the others in lib/landing/industries.ts.
export async function generateMetadata({ params }: PageProps<"/logo-design/[industry]">): Promise<Metadata> {
  const { industry } = await params;
  const content = INDUSTRY_CONTENT[industry as keyof typeof INDUSTRY_CONTENT];
  return content ? landingMetadata(content) : { robots: { index: false } };
}

export default async function IndustryLogoPage({ params }: PageProps<"/logo-design/[industry]">) {
  const { industry } = await params;
  const content = INDUSTRY_CONTENT[industry as keyof typeof INDUSTRY_CONTENT];
  const info = industryOf(industry);
  if (!content || !info) notFound();
  const [{ t }, examples] = await Promise.all([getI18n(), industryExamples(info.type)]);
  return <LandingPage content={content} parent={{ name: t("landing.related.service"), path: "/logo-design" }} examples={examples} />;
}

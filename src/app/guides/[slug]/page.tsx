import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideArticle } from "@/components/guides/guide-article";
import { pictureUrl } from "@/lib/content/pictures";
import { publishedGuide, publishedGuides } from "@/lib/guides/queries";
import { guideText } from "@/lib/guides/rules";
import { getI18n, pageAlternates } from "@/lib/i18n/server";
import { openGraphFor } from "@/lib/seo";
import { canonicalUrl } from "@/lib/site-hosts";

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [g, { locale }] = await Promise.all([publishedGuide(slug), getI18n()]);
  if (!g) return {};
  const x = guideText(g, locale);
  const cover = pictureUrl(g.cover_path);
  const path = `/guides/${g.slug}`;
  return {
    title: x.title.text,
    description: x.summary.text,
    // A guide without its Bangla text yet is only offered in English (the Bangla address would repeat the English).
    alternates: g.bn_ready ? await pageAlternates(path) : { canonical: canonicalUrl(path) },
    openGraph: { ...openGraphFor({ title: x.title.text, description: x.summary.text, path: g.bn_ready ? path : undefined, locale, ...(cover ? { images: [cover] } : {}) }), type: "article", publishedTime: g.published_at ?? undefined, modifiedTime: g.updated_at },
  };
}

// One guide (owner, 2026-10-15): the page reads it; components/guides/guide-article.tsx shows it.
export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const [g, all, { t, locale }] = await Promise.all([publishedGuide(slug), publishedGuides(), getI18n()]);
  if (!g) notFound();
  return <GuideArticle g={g} all={all} t={t} locale={locale} />;
}

/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/panel";
import { requestOrigin } from "@/lib/site-origin";
import { getI18n } from "@/lib/i18n/server";
import { winCardBySlug, winCardImage, winCardThumb } from "@/lib/rewards/win-cards";

/** The card picture as an absolute link, for Facebook and other previews. */
async function absoluteSquare(slug: string, path: string | null) {
  const src = winCardImage(slug, "square", path);
  return src.startsWith("http") ? src : `${await requestOrigin()}${src}`;
}

export async function generateMetadata({ params }: PageProps<"/wins/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [{ t }, card] = await Promise.all([getI18n(), winCardBySlug(slug)]);
  if (!card) return { title: t("winCard.public.notFound"), robots: { index: false } };
  const title = card.hiddenLogo ? t("winCard.public.titleHidden", { name: card.designer.name }) : t("winCard.public.title", { name: card.designer.name, brand: card.contest.brand });
  const image = await absoluteSquare(card.slug, card.squarePath);
  return {
    title,
    description: t("winCard.public.description"),
    openGraph: { title, description: t("winCard.public.description"), images: [{ url: image, width: 1080, height: 1080 }] },
    twitter: { card: "summary_large_image", title, images: [image] },
    // A share card: for Facebook and WhatsApp previews, not a search result (owner, 2026-10-21).
    robots: { index: false, follow: true },
  };
}

// P-15 A contest win (owner, 2026-10-11): the public page a win card links to.
export default async function WinPage({ params }: PageProps<"/wins/[slug]">) {
  const { slug } = await params;
  const [{ t }, card] = await Promise.all([getI18n(), winCardBySlug(slug)]);
  if (!card) notFound();

  return (
    <PageShell className="pt-3.5">
      <section className="mx-auto grid w-full max-w-[1100px] items-center gap-8 rounded-[28px] border border-[#E9EAEE] bg-white p-[18px] sm:p-8 min-[900px]:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <img src={winCardThumb(card.slug, "square")} alt={t("winCard.page.alt", { name: card.designer.name })} width={1080} height={1080} className="aspect-square w-full rounded-[22px] bg-[#8B0000] object-cover" />
        <div className="flex min-w-0 flex-col items-start gap-4">
          <span className="rounded-full bg-[#FFE27A] px-3.5 py-1.5 text-[14px] font-bold uppercase tracking-[0.06em] text-[#111216]">{t("winCard.card.badge")}</span>
          <h1 className="m-0 text-[clamp(28px,3.2vw,44px)] font-semibold leading-[1.06] tracking-[-0.04em]">
            {card.hiddenLogo ? t("winCard.public.titleHidden", { name: card.designer.name }) : t("winCard.public.title", { name: card.designer.name, brand: card.contest.brand })}
          </h1>
          <p className="m-0 max-w-[520px] text-[17px] text-[#5F626B]">{t("winCard.public.lead")}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[15.5px] font-bold">
            {card.designer.username && (
              <Link href={`/d/${card.designer.username}`} className="text-[#8B0000] hover:underline">
                {t("winCard.public.profile", { name: card.designer.name })} →
              </Link>
            )}
            {card.contest.isPublic && !card.hiddenLogo && (
              <Link href={`/contest/${card.contest.slug}?tab=entries&entry=${card.entryNumber}`} className="text-[#8B0000] hover:underline">
                {t("winCard.public.contest")} →
              </Link>
            )}
          </div>
          <div className="mt-2 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <Link href="/start" className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-[linear-gradient(180deg,#B3201B,#8B0000)] px-[22px] text-[16px] font-bold text-white">
              {t("winCard.public.start")}
            </Link>
            <Link href="/designers/signup" className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-[#DCDEE3] bg-white px-5 text-[16px] font-bold text-[#111216]">
              {t("winCard.public.join")}
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

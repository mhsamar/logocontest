/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CardShare } from "@/components/rewards/win-card-share";
import { BackLink } from "@/components/ui/back-link";
import { PageShell } from "@/components/ui/panel";
import { getCurrentUser } from "@/lib/auth/session";
import { linkOrigin } from "@/lib/site-origin";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { prizeText, winCardBySlug, winCardImage, winsThisMonth } from "@/lib/rewards/win-cards";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("winCard.metaTitle"), robots: { index: false } };
}

// D-12 Win card (owner, 2026-10-11; Design/rewards/designer-win-card.html): the designer's card after a contest win.
export default async function WinCardPage({ params }: PageProps<"/dashboard/wins/[slug]">) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?as=designer&next=${encodeURIComponent(`/dashboard/wins/${slug}`)}`);
  const card = await winCardBySlug(slug);
  if (!card || card.designer.id !== user.id) notFound();
  const [{ t, locale }, wins, origin] = await Promise.all([getI18n(), winsThisMonth(user.id), linkOrigin()]);
  const square = winCardImage(card.slug, "square", card.squarePath);
  const story = winCardImage(card.slug, "story", card.storyPath);
  const brand = card.hiddenLogo ? t("winCard.page.hiddenBrand") : card.contest.brand;
  const first = card.designer.name.replace(/^@/, "").split(/\s+/)[0];
  const facts = [
    { label: t("winCard.page.contest"), value: brand },
    { label: t("winCard.page.prize"), value: prizeText(card, locale) },
    { label: t("winCard.page.winsThisMonth"), value: formatNumber(wins, locale) },
  ];

  return (
    <PageShell className="pt-3.5">
      <div className="mx-auto flex w-full max-w-[1384px] flex-col gap-5">
        <BackLink href="/dashboard">{t("winCard.page.back")}</BackLink>
        <section className="rounded-[24px] border border-[#E9EAEE] bg-white p-[18px] sm:p-8">
          <div className="grid items-center gap-9 min-[1021px]:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
            {/* The two card sizes */}
            <div className="flex min-w-0 items-end gap-[18px]">
              <figure className="m-0 flex min-w-0 flex-1 flex-col gap-2">
                <img src={square} alt={t("winCard.page.alt", { name: card.designer.name })} width={1080} height={1080} className="aspect-square w-full rounded-[20px] bg-[#8B0000] object-cover" />
                <figcaption className="text-[13.5px] font-bold text-[#5F626B]">{t("winCard.page.squareSize")}</figcaption>
              </figure>
              <figure className="m-0 flex min-w-0 flex-[0_0_27%] flex-col gap-2">
                <img src={story} alt={t("winCard.page.alt", { name: card.designer.name })} width={1080} height={1920} className="aspect-[9/16] w-full rounded-[20px] bg-[#8B0000] object-cover" />
                <figcaption className="text-[13.5px] font-bold text-[#5F626B]">{t("winCard.page.storySize")}</figcaption>
              </figure>
            </div>
            <div className="flex min-w-0 flex-col items-start gap-4">
              <span className="rounded-full bg-[#E3F3EA] px-3.5 py-1.5 text-[15px] font-bold text-[#14633C]">{t("winCard.page.eyebrow")}</span>
              <h1 className="m-0 text-[clamp(30px,3.4vw,46px)] font-semibold leading-[1.05] tracking-[-0.04em]">
                {t("winCard.page.title", { name: first })}
                <br />
                {t("winCard.page.title2")}
              </h1>
              <p className="m-0 max-w-[520px] text-[#5F626B]">{card.hiddenLogo ? t("winCard.page.leadHidden") : t("winCard.page.lead", { brand: card.contest.brand })}</p>
              <dl className="m-0 flex w-full max-w-[560px] flex-wrap gap-2">
                {facts.map((f) => (
                  <div key={f.label} className="flex flex-[1_1_130px] flex-col-reverse gap-0.5 rounded-[14px] bg-[#F4F5F7] px-3.5 py-3">
                    <dt className="text-[13.5px] font-bold text-[#5F626B]">{f.label}</dt>
                    <dd className="lc-d m-0 truncate text-[21px] font-semibold tracking-[-0.02em]">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <CardShare
                images={{ square, story }}
                pageUrl={`${origin}/wins/${card.slug}`}
                fileName={`logocontest-win-${card.slug}`}
                shareText={card.hiddenLogo ? t("winCard.share.textHidden") : t("winCard.share.text", { brand: card.contest.brand })}
              />
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

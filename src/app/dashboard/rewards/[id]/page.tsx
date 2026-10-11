/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RewardClaim, StepLabel } from "@/components/rewards/reward-claim";
import { CardShare } from "@/components/rewards/win-card-share";
import { BackLink } from "@/components/ui/back-link";
import { PageShell } from "@/components/ui/panel";
import { getCurrentUser } from "@/lib/auth/session";
import { cx } from "@/lib/cx";
import { siteOrigin } from "@/lib/email";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { monthLabel } from "@/lib/notifications/render";
import { claimDeadline, myReward } from "@/lib/rewards/claims";
import { getSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("monthlyReward.page.metaTitle"), robots: { index: false } };
}

const Tick = ({ size }: { size: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

// D-13 / C-24 Monthly prize (owner, 2026-10-11; Design/rewards/client-smartphone-claim.html, designer-gift-box-claim.html):
// the winner's congratulation card, the claim form, and "Claim successful" with the progress.
export default async function RewardPage({ params }: PageProps<"/dashboard/rewards/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/dashboard/rewards/${id}`)}`);
  const reward = await myReward(id, user.id);
  if (!reward) notFound();
  const [{ t, locale }, origin, deadlineSetting] = await Promise.all([getI18n(), siteOrigin(), getSetting("rewards.claim_deadline")]);
  const phone = reward.kind === "smartphone";
  const month = monthLabel(reward.month, locale);
  const prize = t(phone ? "monthlyReward.page.smartphone" : "monthlyReward.page.giftBox");
  const name = (user.name || "").trim();
  const first = name.split(/\s+/)[0] || name;
  const deadline = claimDeadline(deadlineSetting);
  const fmt = (n: number) => formatNumber(n, locale);
  const share = { pageUrl: `${origin}/leaderboard?month=${reward.month}`, fileName: `logocontest-${reward.kind.replace("_", "-")}-${reward.month}`, shareText: t(phone ? "monthlyReward.page.shareSmartphone" : "monthlyReward.page.shareGiftBox", { month }) };
  const cardAlt = t("monthlyReward.page.alt", { name, prize });

  if (reward.status === "not_claimed") {
    const stats = phone
      ? [
          { label: t("monthlyReward.page.yourContests"), value: fmt(reward.stats.contests ?? 0) },
          { label: t("monthlyReward.page.prizeMoney"), value: formatTaka(reward.stats.prize_total ?? 0, locale) },
        ]
      : [
          { label: t("monthlyReward.page.yourWins"), value: fmt(reward.stats.wins ?? 0) },
          { label: t("monthlyReward.page.youEarned"), value: formatTaka(reward.stats.earned ?? 0, locale) },
        ];
    return (
      <PageShell className="pt-3.5">
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5">
          <BackLink href="/dashboard">{t("winCard.page.back")}</BackLink>
          <RewardClaim
            rewardId={reward.id}
            kind={reward.kind}
            images={reward.images}
            cardAlt={cardAlt}
            title={t("monthlyReward.page.title", { name: first })}
            title2={t(phone ? "monthlyReward.page.wonSmartphone" : "monthlyReward.page.wonGiftBox")}
            lead={t(phone ? "monthlyReward.page.leadSmartphone" : "monthlyReward.page.leadGiftBox", { month })}
            stats={stats}
            claimLabel={t(phone ? "monthlyReward.page.claimSmartphone" : "monthlyReward.page.claimGiftBox")}
            formTitle={t(phone ? "monthlyReward.form.titleSmartphone" : "monthlyReward.form.titleGiftBox")}
            deadline={deadline ? deadline.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "long", timeZone: "Asia/Dhaka" }) : null}
            closed={Boolean(deadline && new Date() > deadline)}
            share={share}
          />
        </div>
      </PageShell>
    );
  }

  // Step 3: claimed. Read-only; changes go through support.
  const claim = reward.claim!;
  const rows = [
    { label: t("monthlyReward.done.prize"), value: `${prize} · ${month}` },
    { label: t("monthlyReward.done.name"), value: claim.name },
    { label: t("monthlyReward.done.call"), value: `${claim.mobile.slice(0, 5)}-${claim.mobile.slice(5)}` },
    { label: t("monthlyReward.done.sendTo"), value: claim.address },
  ];
  const progress = [
    { text: t("monthlyReward.done.received"), done: true },
    { text: t("monthlyReward.done.calling"), done: reward.status === "contacted" || reward.status === "delivered" },
    { text: t(phone ? "monthlyReward.done.deliveredSmartphone" : "monthlyReward.done.deliveredGiftBox"), done: reward.status === "delivered" },
  ];
  return (
    <PageShell className="pt-3.5">
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5">
        <BackLink href="/dashboard">{t("winCard.page.back")}</BackLink>
        <section className="flex flex-col gap-3.5 rounded-[24px] border border-[#E9EAEE] bg-white p-[18px] sm:p-[22px]">
          <StepLabel n={3}>{t("monthlyReward.page.step3")}</StepLabel>
          <div className="flex flex-col items-center gap-3 rounded-[18px] bg-[#E3F3EA] px-[18px] py-[26px] text-center">
            <span className="flex size-[68px] items-center justify-center rounded-full bg-[#14633C] text-white">
              <Tick size={34} />
            </span>
            <h1 className="m-0 text-[28px] font-semibold leading-[1.1] tracking-[-0.035em] text-[#0E4A2C]">{t("monthlyReward.done.title")}</h1>
            <p className="m-0 text-[17px] font-semibold text-[#14633C]">{t("monthlyReward.done.lead")}</p>
          </div>
          <dl className="m-0 flex flex-col rounded-[14px] border border-[#E9EAEE] text-[15.5px]">
            <div className="flex justify-between gap-3 px-3.5 py-3">
              <dt className="text-[#5F626B]">{t("monthlyReward.done.claimId")}</dt>
              <dd className="m-0 rounded-[7px] border border-[#E3E4E8] px-2 py-0.5 font-mono text-[13px] font-semibold tracking-[.04em]">{reward.number}</dd>
            </div>
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-3 border-t border-[#EEEFF2] px-3.5 py-3">
                <dt className="shrink-0 text-[#5F626B]">{r.label}</dt>
                <dd className="m-0 min-w-0 text-right font-bold [overflow-wrap:anywhere]">{r.value}</dd>
              </div>
            ))}
          </dl>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15.5px]">
            {progress.map((s) => (
              <li key={s.text} className="flex items-center gap-2.5">
                {s.done ? (
                  <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-[#14633C] text-white">
                    <Tick size={15} />
                  </span>
                ) : (
                  <span className="size-[26px] flex-none rounded-full border-2 border-[#B9BCC4]" />
                )}
                <span className={cx(s.done && "font-bold")}>{s.text}</span>
              </li>
            ))}
          </ol>
          <Link href="/dashboard" className="inline-flex min-h-[50px] w-full items-center justify-center rounded-full border border-[#DCDEE3] bg-white px-5 text-[16px] font-bold">
            {t("monthlyReward.done.back")}
          </Link>
          <p className="m-0 text-[14px] text-[#5F626B]">
            {t("monthlyReward.done.wrong")}{" "}
            <Link href="/support" className="font-bold text-[#8B0000]">
              {t("monthlyReward.done.support")}
            </Link>
          </p>
        </section>
        {/* The photo card stays here to download or share */}
        <section className="flex items-center gap-3.5 rounded-[24px] border border-[#E9EAEE] bg-white p-[14px]">
          <img src={reward.images.square} alt={cardAlt} width={1080} height={1080} className={cx("size-[88px] flex-none rounded-[14px] object-cover", phone ? "bg-[#8B0000]" : "bg-[#FFDF9C]")} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-[14px] font-bold text-[#5F626B]">{t("monthlyReward.done.yourCard")}</span>
            <CardShare compact images={reward.images} pageUrl={share.pageUrl} fileName={share.fileName} shareText={share.shareText} />
          </div>
        </section>
      </div>
    </PageShell>
  );
}

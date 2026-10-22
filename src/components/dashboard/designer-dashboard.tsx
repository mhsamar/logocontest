import Link from "next/link";
import { MyContestDesigns } from "@/components/dashboard/my-designs";
import { ShareProfile } from "@/components/designers/share-profile";
import { ProfileProgress } from "@/components/settings/profile-progress";
import { PhoneNotifications } from "@/components/push/phone-notifications";
import type { ProfileStep } from "@/lib/profile/completeness";
import { PrizeBanner } from "@/components/rewards/prize-banner";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow } from "@/components/ui/section-heading";
import { WinnerTrophy } from "@/components/ui/trophy";
import { WithdrawButton } from "@/components/wallet/withdraw-form";
import { StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import type { DesignerContest, DesignerProfile } from "@/lib/designers/profile";
import { getI18n } from "@/lib/i18n/server";
import type { MyReward } from "@/lib/rewards/claims";
import { formatNumber, formatTaka } from "@/lib/money";
import type { Wallet } from "@/lib/wallet/queries";

function Block({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("lc-card p-5 sm:p-7", className)}>
      {/* Phones (owner, 2026-10-17): the links go under the title instead of squeezing it onto two lines. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 shrink-0 text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ text, cta }: { text: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[20px] border border-dashed border-line bg-chip/60 px-4 py-8 text-center">
      <p className="m-0 text-[15px] text-muted">{text}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

/** D-02 designer dashboard (UI-JOURNEY, owner 2026-10-08). */
export async function DesignerDashboard({
  designer,
  contests,
  savedCount,
  profileUrl,
  qrSvg,
  handovers,
  wallet,
  winCards = [],
  prizes = [],
  profileSteps = [],
}: {
  designer: DesignerProfile;
  contests: DesignerContest[];
  savedCount: number;
  profileUrl: string;
  qrSvg: string;
  /** Wins whose files are still to be delivered or approved (owner, 2026-10-08). */
  handovers: { slug: string; brand: string; status: string; dueAt: Date; credit: number }[];
  /** The whole wallet (owner, 2026-10-16): every detail on the dashboard. */
  wallet: Wallet;
  /** Win cards (owner, 2026-10-11), newest first. */
  winCards?: { slug: string; brand: string | null; image: string }[];
  /** Monthly prizes waiting for a claim (2026-10-11). */
  prizes?: MyReward[];
  /** "Complete your profile" (owner, 2026-10-13). */
  profileSteps?: { key: ProfileStep; done: boolean }[];
}) {
  const { t, locale } = await getI18n();
  const taka = (n: number) => formatTaka(n, locale);
  const wins = contests.filter((c) => c.won);
  // Payment cards (owner, 2026-10-12): one per paid withdrawal, newest first.
  const paidCards = wallet.withdrawals.filter((w) => w.status === "paid").slice(0, 10);
  const lastPaid = paidCards[0] ?? null;
  const stats = [
    { label: t("designerDash.stats.contests"), value: formatNumber(designer.stats.contestsEntered, locale) },
    { label: t("designerDash.stats.designs"), value: formatNumber(designer.stats.designs, locale) },
    { label: t("designerDash.stats.wins"), value: formatNumber(designer.stats.wins, locale) },
    { label: t("designerDash.stats.earned"), value: formatTaka(designer.stats.totalEarned, locale), accent: true },
  ];

  return (
    <PageShell>
      {/* Profile panel */}
      <Panel as="header" className="max-[720px]:py-6">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="shrink-0 rounded-full bg-[image:var(--gradient-red)] p-[3px]">
              <Avatar name={designer.name} url={designer.avatarUrl} tone="cream" className="size-16 text-xl ring-2 ring-white sm:size-20 sm:text-2xl" />
            </span>
            <div className="min-w-0">
              <h1 className="m-0 truncate text-[clamp(28px,3.6vw,42px)] font-semibold leading-[1.1] tracking-[-0.035em] text-ink">{t("dashboard.hi", { name: designer.name })}</h1>
              <p className="m-0 mt-1 flex flex-col text-[15px] text-muted sm:flex-row sm:gap-1.5">
                <span className="font-mono">@{designer.username}</span>
                <span className="hidden sm:inline">·</span>
                <span>{t("dashboard.memberSince", { date: formatDate(designer.memberSince, locale, "month") })}</span>
              </p>
              {designer.isTopDesigner && (
                <span className="mt-2 inline-flex rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-gold-ink">{t("designerProfile.topDesigner")}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <ButtonLink href="/dashboard/profile">{t("designerDash.editProfile")}</ButtonLink>
            <ButtonLink href={`/d/${designer.username}`} variant="secondary">
              {t("designerDash.viewProfile")}
            </ButtonLink>
          </div>
        </div>

        <dl className="relative m-0 mt-7 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className={cx("flex flex-col-reverse rounded-[20px] px-4 py-3.5", s.accent ? "bg-[#fff6d6]" : "bg-chip")}>
              <dt className="mt-0.5 text-[13px] font-medium text-muted">{s.label}</dt>
              <dd className={cx("lc-d m-0 truncate text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-ink sm:text-[26px]", s.accent && "text-gold-ink")}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel tone="grey" className="space-y-3.5 max-[720px]:py-4">
        <PrizeBanner rewards={prizes} />
        <ProfileProgress steps={profileSteps} />
        <PhoneNotifications role="designer" prompt />

        {/* You won: files to deliver (D-08) */}
        {handovers.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            {handovers.map((h) => (
              <Link
                key={h.slug}
                href={`/dashboard/handover/${h.slug}`}
                className="lc-g group flex items-center gap-4 rounded-[22px] bg-[image:var(--gradient-red-dark)] p-5 text-white transition-[filter] duration-300 hover:brightness-110"
              >
                <span className="text-3xl" aria-hidden>
                  🏆
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold">{t("designerDash.won.title", { brand: h.brand })}</span>
                  <span className="block text-[15px] text-white/80">
                    {h.status === "submitted" ? t("designerDash.won.waiting") : t("designerDash.won.due", { date: formatDate(h.dueAt, locale, "short") })}
                  </span>
                </span>
                <span className="lc-d shrink-0 text-2xl font-semibold tabular-nums text-gold">{formatTaka(h.credit, locale)}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Money (owner, 2026-10-16): every detail of the wallet here, and the payment card */}
        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <section aria-labelledby="dd-wallet" className="flex flex-col rounded-[28px] bg-[image:var(--gradient-red-dark)] p-6 text-white sm:p-7" data-dash-wallet>
            <div className="flex items-center justify-between gap-3">
              <h2 id="dd-wallet" className="m-0 text-[15px] font-bold uppercase tracking-[0.14em] text-gold">
                {t("wallet.available")}
              </h2>
              <Link href="/dashboard/wallet" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 text-[15px] font-bold text-white ring-1 ring-white/20 hover:bg-white/20">
                {t("designerDash.money.openWallet")}
                <Arrow />
              </Link>
            </div>
            <p className="lc-d m-0 mt-1 text-[clamp(42px,5vw,56px)] font-semibold leading-none tabular-nums tracking-[-0.04em] text-gold">{taka(wallet.balance)}</p>
            <p className="m-0 mt-2 text-[16px] text-white/80">{t("wallet.feeNow", { rate: formatNumber(wallet.rate, locale) })}</p>
            <dl className="m-0 mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { k: t("wallet.pending"), v: wallet.pending },
                { k: t("wallet.onItsWay"), v: wallet.requested.total },
                { k: t("wallet.sentSoFar"), v: wallet.paidOut.total },
                { k: t("wallet.earnedHere"), v: wallet.earned },
              ].map((x) => (
                <div key={x.k} className="flex flex-col rounded-[18px] bg-white/10 px-4 py-3 ring-1 ring-white/15">
                  <dt className="text-[14px] leading-snug text-white/75">{x.k}</dt>
                  <dd className="lc-d m-0 text-[22px] font-semibold tabular-nums text-white">{taka(x.v)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 [&_p]:text-[15px] [&_p]:text-white/80">
              <WithdrawButton balance={wallet.balance} min={wallet.minWithdrawal} methods={wallet.methods} />
            </div>
          </section>

          {/* The newest "Payment sent" card (owner, 2026-10-16) */}
          <section aria-labelledby="dd-paycard" className="flex flex-col rounded-[28px] bg-[linear-gradient(135deg,#FFF1CF,#FFE2A6)] p-5 sm:p-6" data-dash-paycard>
            <h2 id="dd-paycard" className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-ink">
              {t("payoutCard.title")}
            </h2>
            {lastPaid ? (
              <div className="mt-3 flex flex-1 flex-col gap-4 sm:flex-row sm:items-center lg:flex-col lg:items-start xl:flex-row xl:items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/cards/payout/${lastPaid.id}/square`}
                  alt={t("payoutCard.alt", { amount: taka(lastPaid.amount) })}
                  loading="lazy"
                  className="aspect-square w-full max-w-[11rem] shrink-0 rounded-[18px] bg-[#FFDF9C] object-cover shadow-card"
                />
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="lc-d m-0 text-[28px] font-semibold tabular-nums text-ink">{taka(lastPaid.amount)}</p>
                  <p className="m-0 text-[16px] text-[#4A3700]">
                    {lastPaid.destination}
                    <br />
                    {t("wallet.paidOn", { date: formatDate(lastPaid.processedAt ?? lastPaid.createdAt, locale, "long") })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/cards/payout/${lastPaid.id}/square?download=1`} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[image:var(--gradient-red)] px-5 text-[15px] font-bold text-white">
                      {t("payoutCard.square")}
                    </a>
                    <a href={`/api/cards/payout/${lastPaid.id}/story?download=1`} className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-[15px] font-bold text-primary ring-1 ring-line">
                      {t("payoutCard.story")}
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <p className="m-0 mt-2 text-[16px] leading-relaxed text-[#4A3700]">{t("designerDash.money.noCard", { min: taka(wallet.minWithdrawal) })}</p>
            )}
          </section>
        </div>

        {/* Share (owner, 2026-10-16: a low card) */}
        <section className="lc-card p-4 sm:px-6 sm:py-5" aria-labelledby="dd-share">
          <ShareProfile
            compact
            url={profileUrl}
            qrSvg={qrSvg}
            qrDownloadHref={`/d/${designer.username}/qr?download=1`}
            name={designer.name}
            header={
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h2 id="dd-share" className="m-0 text-lg font-semibold tracking-[-0.02em] text-ink">
                    {t("designerDash.share.title")}
                  </h2>
                  <p className="m-0 text-sm text-muted">{t("designerDash.share.subtitle")}</p>
                </div>
                {/* Portfolio (owner, 2026-10-08): the public profile as a PDF, and where to edit it */}
                <div className="flex shrink-0 gap-2">
                  <ButtonLink href="/dashboard/profile" variant="secondary">
                    {t("portfolio.title")}
                  </ButtonLink>
                  <a href={`/d/${designer.username}/portfolio`} className={buttonClasses({ variant: "dark" })} title={t("portfolio.subtitle")}>
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                    </svg>
                    {t("portfolio.downloadPdf")}
                  </a>
                </div>
              </div>
            }
          />
        </section>

        {/* My contests, full width (owner, 2026-10-16) */}
        <Block
          title={t("designerDash.myContests")}
          action={
            <div className="flex flex-wrap items-center gap-x-4">
              <Link href="/dashboard/saved" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-ink hover:text-primary">
                <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="currentColor" aria-hidden>
                  <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
                </svg>
                {t("nav.saved")}
                <span className="rounded-full bg-chip px-2 py-0.5 text-[13px] tabular-nums text-muted">{formatNumber(savedCount, locale)}</span>
              </Link>
              <Link href="/contests" className="inline-flex min-h-11 items-center text-[15px] font-bold text-primary hover:underline">
                {t("designerDash.browse")}
              </Link>
            </div>
          }
        >
          {contests.length > 0 ? (
            <ul className="m-0 list-none divide-y divide-line p-0">
              {contests.map((c) => (
                <li key={c.slug} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3.5 sm:flex-nowrap">
                  <div className="flex min-w-0 flex-1 items-center gap-3 sm:w-56 sm:flex-none">
                    {/* The designer's newest design in this contest (its preview) */}
                    <Link
                      href={`/contest/${c.slug}?tab=entries`}
                      className="relative size-14 shrink-0 overflow-hidden rounded-[14px] bg-chip ring-1 ring-line"
                      aria-hidden
                      tabIndex={-1}
                    >
                      {c.latestCoverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.winningLogoUrl ?? c.latestCoverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                      {c.won && <WinnerTrophy size="sm" className="absolute -right-0.5 -top-0.5 scale-75" />}
                    </Link>
                    <div className="min-w-0">
                      <Link href={`/contest/${c.slug}?tab=entries`} className="block truncate text-[16px] font-semibold text-ink hover:text-primary">
                        {c.brandName}
                      </Link>
                      <p className="m-0 text-[14px] text-muted">{t("designerDash.myEntries", { count: formatNumber(c.myEntries, locale) })}</p>
                    </div>
                  </div>
                  {/* Owner, 2026-10-16: every picture of my designs here; hover for a quick view, click to open it here. */}
                  <MyContestDesigns slug={c.slug} brand={c.brandName} designs={c.designs} open={c.open} className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto" />
                  <span className="shrink-0">
                    <StatusChip status={c.status as ChipStatus} label={t(`status.${c.status as ChipStatus}`)} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text={t("designerDash.noContests")} cta={<ButtonLink href="/contests">{t("designerDash.browse")}</ButtonLink>} />
          )}
        </Block>

        {/* Wins with large logos (owner, 2026-10-16) */}
        <Block title={t("designerDash.wins")}>
          {wins.length > 0 ? (
            <ul className="m-0 grid list-none grid-cols-2 gap-3.5 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-dash-wins>
              {wins.map((w) => (
                <li key={w.slug}>
                  <Link href={`/contest/${w.slug}`} className="group relative block overflow-hidden rounded-[22px] bg-white ring-1 ring-line transition-shadow hover:shadow-card hover:ring-primary">
                    <WinnerTrophy size="md" className="absolute right-2.5 top-2.5 z-10" />
                    {w.winningLogoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.winningLogoUrl} alt="" loading="lazy" className="aspect-square w-full bg-white object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02]" />
                    )}
                    <span className="block border-t border-line px-3.5 py-2.5">
                      <span className="block truncate text-[16px] font-semibold text-ink">{w.brandName}</span>
                      {w.prize > 0 && <span className="block text-[14px] text-muted">{t("designerDash.money.prize", { amount: taka(w.prize) })}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text={t("designerDash.noWins")} />
          )}
        </Block>

        {/* Your cards: win cards and payment cards, large (owner, 2026-10-11; 2026-10-16) */}
        {(winCards.length > 0 || paidCards.length > 0) && (
          <Block title={t("designerDash.money.cardsTitle")} action={<span className="text-[15px] text-muted">{t("winCard.dashboard.lead")}</span>}>
            <ul className="m-0 grid list-none grid-cols-2 gap-3.5 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-dash-cards>
              {winCards.map((w) => (
                <li key={`win-${w.slug}`}>
                  <Link href={`/dashboard/wins/${w.slug}`} className="group block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.image} alt="" loading="lazy" className="aspect-square w-full rounded-[20px] bg-[#8B0000] object-cover shadow-card transition-transform duration-300 group-hover:-translate-y-0.5" />
                    <span className="mt-2 block truncate text-[16px] font-semibold text-ink">{w.brand ?? t("winCard.page.hiddenBrand")}</span>
                    <span className="block text-[14px] text-muted">{t("designerDash.money.winCard")}</span>
                  </Link>
                </li>
              ))}
              {paidCards.map((wd) => (
                <li key={`pay-${wd.id}`}>
                  <a href={`/api/cards/payout/${wd.id}/square`} target="_blank" rel="noopener" className="group block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/cards/payout/${wd.id}/square`} alt={t("payoutCard.alt", { amount: taka(wd.amount) })} loading="lazy" className="aspect-square w-full rounded-[20px] bg-[#FFDF9C] object-cover shadow-card transition-transform duration-300 group-hover:-translate-y-0.5" />
                    <span className="mt-2 block truncate text-[16px] font-semibold text-ink">{taka(wd.amount)}</span>
                    <span className="block text-[14px] text-muted">{t("designerDash.money.payCard", { date: formatDate(wd.processedAt ?? wd.createdAt, locale, "short") })}</span>
                  </a>
                  <a href={`/api/cards/payout/${wd.id}/square?download=1`} className="mt-1 inline-flex min-h-9 items-center text-[14px] font-bold text-primary hover:underline">
                    {t("designerDash.money.download")}
                  </a>
                </li>
              ))}
            </ul>
          </Block>
        )}
      </Panel>
    </PageShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrandTile, ContestNumber, PackagePill, PRIZE_TEXT, StatusLine } from "@/components/contests/contest-bits";
import { EntryComments } from "@/components/entries/entry-comments";
import { Collage } from "@/components/entries/entry-card";
import { EntryViewer } from "@/components/entries/entry-viewer";
import { AddonsPanel } from "@/components/manage/addons-panel";
import { OwnerActions } from "@/components/manage/owner-actions";
import { ScanPanel } from "@/components/manage/scan-panel";
import { Alert } from "@/components/ui/alert";
import { GlideTrack } from "@/components/ui/glide-track";
import { CountUp } from "@/components/ui/count-up";
import { StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import { WinnerTrophy } from "@/components/ui/trophy";
import { getCurrentUser } from "@/lib/auth/session";
import { addonPrices } from "@/lib/contests/addon-payments";
import { getContestBySlug } from "@/lib/contests/browse";
import { cx } from "@/lib/cx";
import { getEntryDetail, latestScan, listEntries } from "@/lib/entries/queries";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("manage.metaTitle"), robots: { index: false } };
}

const FILTERS = ["all", "shortlisted", "unrated", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

// C-13b Manage contest (owner, 2026-10-08): add-ons, and reviewing designs with stars, shortlist, reject and pick winner.
export default async function ManageContestPage({ params, searchParams }: PageProps<"/dashboard/contests/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect(`/login?as=client&next=${encodeURIComponent(`/dashboard/contests/${slug}`)}`);
  const contest = await getContestBySlug(slug, user);
  if (!contest || !contest.isOwner) notFound();
  if (contest.rawStatus === "draft" || contest.rawStatus === "pending_payment") redirect(`/start?draft=${contest.id}`);

  const base = `/dashboard/contests/${contest.slug}`;
  const filter: Filter = FILTERS.find((f) => f === sp.filter) ?? "all";
  const entryContest = {
    ownerId: contest.ownerId,
    isBlind: contest.isBlind,
    canSeeBrief: true,
    status: contest.status,
    winnerIsPublic: contest.winnerIsPublic,
  };
  const entryNumber = typeof sp.entry === "string" ? Number(sp.entry) : null;
  const [entries, prices, s, entry] = await Promise.all([
    listEntries(contest.id, entryContest, user),
    addonPrices(),
    getSettings(["timers.designer_file_upload_days", "limits.contest_comment_max_length"]),
    entryNumber ? getEntryDetail(contest.id, entryNumber, entryContest, user) : null,
  ]);
  const scan = entry ? await latestScan(entry.id) : null;
  const fileDays = s["timers.designer_file_upload_days"];
  const reviewing = contest.status === "open" || contest.status === "judging";
  const fmt = (n: number) => formatNumber(n, locale);

  const shown = entries.filter((e) =>
    filter === "shortlisted"
      ? e.isShortlisted && e.status !== "rejected"
      : filter === "unrated"
        ? !e.rating && e.status === "active"
        : filter === "rejected"
          ? e.status === "rejected"
          : e.status !== "rejected",
  );
  const counts: Record<Filter, number> = {
    all: entries.filter((e) => e.status !== "rejected").length,
    shortlisted: entries.filter((e) => e.isShortlisted && e.status !== "rejected").length,
    unrated: entries.filter((e) => !e.rating && e.status === "active").length,
    rejected: entries.filter((e) => e.status === "rejected").length,
  };
  const stats = [
    { label: t("manage.stats.designs"), value: <CountUp value={counts.all} locale={locale} /> },
    { label: t("manage.stats.designers"), value: <CountUp value={contest.designers} locale={locale} /> },
    { label: t("manage.stats.shortlisted"), value: <CountUp value={counts.shortlisted} locale={locale} /> },
    {
      label: t("manage.stats.rated"),
      value: <CountUp value={entries.filter((e) => e.rating).length} locale={locale} />,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      <Link
        href="/dashboard"
        className="group inline-flex min-h-12 animate-fade-in items-center gap-3 rounded-full py-1 pr-4 text-lg font-bold text-ink transition-colors hover:text-primary"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-card ring-1 ring-line transition-transform duration-300 group-hover:-translate-x-1 group-hover:shadow-raised">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </span>
        {t("manage.back")}
      </Link>

      {sp.payment === "paid" && (
        <div className="mt-2 animate-rise">
          <Alert tone="success">{t("manage.payment.paid")}</Alert>
        </div>
      )}
      {sp.payment === "failed" && (
        <div className="mt-2 animate-rise">
          <Alert tone="danger">{t("manage.payment.failed")}</Alert>
        </div>
      )}

      {/* Header */}
      <section className="relative mt-3 animate-rise overflow-hidden bg-aurora rounded-[2rem] p-5 shadow-frame ring-1 ring-white sm:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl shadow-raised ring-4 ring-white sm:size-24">
              <BrandTile name={contest.brandName} isPrivate={false} cover={contest.cover} flat className="h-full w-full text-[1.2rem]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={contest.status as ChipStatus} label={t(`status.${contest.status as ChipStatus}`)} />
                <PackagePill pkg={contest.package} t={t} />
                <ContestNumber n={contest.number} t={t} locale={locale} />
              </div>
              <h1 className="mt-1.5 truncate text-h1 font-bold tracking-tight text-ink lg:text-4xl">{contest.brandName}</h1>
              <div className="mt-1 text-sm">
                <StatusLine contest={contest} now={new Date()} t={t} locale={locale} />
              </div>
            </div>
          </div>
          {/* Prize, Edit and Public page: three tiles of one size (owner, 2026-10-08) */}
          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-stretch">
            <div className="col-span-2 prize-glow flex min-h-[5.5rem] animate-rise flex-col justify-center rounded-2xl bg-gradient-to-br from-[#fff9e8] via-[#fff0c7] to-[#ffe2a0] px-5 py-3 shadow-card ring-1 ring-[#f1c75c]/70 sm:min-w-44">
              <p className="text-xs font-semibold text-[#8a5105]">{t("contest.stats.prize")}</p>
              <p className={cx("text-3xl font-extrabold tabular-nums", PRIZE_TEXT)}><CountUp value={contest.prize} locale={locale} taka /></p>
            </div>
            {contest.status === "open" && (
              <Link
                href={`${base}/edit`}
                className="group relative flex min-h-[5.5rem] animate-rise flex-col justify-between overflow-clip rounded-2xl bg-gradient-to-br from-ink via-[#3a1d14] to-primary-dark px-4 py-3 text-white shadow-card transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-raised sm:min-w-44"
                style={{ animationDelay: "80ms" }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-150"
                />
                <span className="relative flex size-8 items-center justify-center rounded-lg bg-white/15 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 20h4L19 9l-4-4L4 16Z" />
                  </svg>
                </span>
                <span className="relative mt-2">
                  <span className="block font-bold leading-tight">{t("manage.edit.button")}</span>
                  <span className="block text-xs text-white/70">{t("manage.edit.hint")}</span>
                </span>
              </Link>
            )}
            <a
              href={`/contest/${contest.slug}`}
              target="_blank"
              rel="noopener"
              className={cx(
                "group relative flex min-h-[5.5rem] animate-rise flex-col justify-between overflow-clip rounded-2xl bg-white/80 px-4 py-3 text-ink shadow-card ring-1 ring-white backdrop-blur transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-raised sm:min-w-44",
                contest.status !== "open" && "col-span-2",
              )}
              style={{ animationDelay: "160ms" }}
            >
              <span className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#e8f1ff] to-[#d4e4ff] text-[#1d4ed8] transition-transform duration-300 group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="size-4 text-muted transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </span>
              <span className="mt-2">
                <span className="block font-bold leading-tight">{t("manage.publicPage")}</span>
                <span className="block text-xs text-muted">{t("manage.publicHint")}</span>
              </span>
            </a>
          </div>
        </div>
        <dl className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((st, i) => (
            <div
              key={st.label}
              className="flex animate-rise flex-col-reverse rounded-xl bg-white/75 px-4 py-3 ring-1 ring-white backdrop-blur"
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <dt className="mt-0.5 text-xs text-muted">{st.label}</dt>
              <dd className="text-2xl font-bold tabular-nums text-ink">{st.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Review designs on the left, add-ons in a sidebar on the right (owner, 2026-10-08) */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-h3 font-bold text-ink lg:text-h3-lg">{t("manage.review.title")}</h2>
            <nav className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
              <GlideTrack className="w-max">
                <ul className="flex w-max gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
                  {FILTERS.map((f) => (
                    <li key={f}>
                      <Link
                        href={f === "all" ? base : `${base}?filter=${f}`}
                        scroll={false}
                        aria-current={f === filter ? "page" : undefined}
                        className={cx(
                          "relative flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                          f === filter ? "bg-ink text-white" : "text-muted hover:text-ink",
                        )}
                      >
                        {t(`manage.review.filters.${f}`)}
                        <span className={cx("rounded-full px-1.5 text-xs tabular-nums", f === filter ? "bg-white/15" : "bg-canvas")}>{fmt(counts[f])}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </GlideTrack>
            </nav>
          </div>

          {shown.length > 0 ? (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {shown.map((e, i) => (
                <li
                  key={e.id}
                  className={cx(
                    "animate-rise overflow-hidden rounded-2xl bg-surface shadow-card ring-1 transition-shadow hover:shadow-raised",
                    e.status === "winner" ? "ring-2 ring-primary" : "ring-line",
                  )}
                  style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}
                >
                  <Link
                    href={`${base}?${filter !== "all" ? `filter=${filter}&` : ""}entry=${e.number}`}
                    scroll={false}
                    className="relative block"
                    aria-label={t("entry.open", { n: fmt(e.number) })}
                  >
                    <Collage previews={e.previews} total={e.imageCount} />
                    {e.status === "winner" && <WinnerTrophy size="sm" className="absolute right-2 top-2" />}
                    {e.isShortlisted && e.status !== "rejected" && (
                      <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">
                        {t("manage.review.filters.shortlisted")}
                      </span>
                    )}
                  </Link>
                  <div className="px-3 pb-2 pt-2.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-ink">#{fmt(e.number)}</span>
                      <span className="truncate text-xs text-muted">{e.designer?.username ? `@${e.designer.username}` : e.designer?.name}</span>
                    </div>
                    <div className="mt-1">
                      <OwnerActions
                        entryId={e.id}
                        number={e.number}
                        rating={e.rating}
                        shortlisted={e.isShortlisted}
                        canAct={reviewing && e.status === "active"}
                        fileDays={fileDays}
                        variant="card"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-4 py-12 text-center text-muted">{t("manage.review.empty")}</p>
          )}
        </section>

        <aside id="addons" className="scroll-mt-28 lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:rounded-3xl lg:[scrollbar-width:thin]">
          <div className="animate-rise overflow-hidden rounded-3xl bg-aurora p-4 shadow-card ring-1 ring-white sm:p-5" style={{ animationDelay: "120ms" }}>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 animate-float-soft items-center justify-center rounded-xl bg-gradient-to-br from-ink to-primary-dark text-white shadow-card">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
                </svg>
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight text-ink">{t("dashboard.addons")}</h2>
                <p className="mt-0.5 text-xs text-muted">{t("manage.addons.subtitle")}</p>
              </div>
            </div>
            <div className="mt-4">
              <AddonsPanel
                contestId={contest.id}
                open={contest.status === "open"}
                active={{
                  promote: contest.isPromoted,
                  private: contest.isPrivate,
                  blind: contest.isBlind,
                  logo_scan: contest.logoScan,
                }}
                prices={prices}
                extensionDays={prices.extensionDays}
                endsAt={contest.endsAt ? contest.endsAt.toISOString() : null}
                locale={locale}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* C-15: one design with the owner tools */}
      {entry && (
        <EntryViewer
          number={entry.number}
          images={entry.previews}
          closeHref={filter !== "all" ? `${base}?filter=${filter}` : base}
          byline={
            entry.designer
              ? t("entry.by", {
                  name: entry.designer.username ? `@${entry.designer.username}` : entry.designer.name,
                })
              : t("entry.hiddenName")
          }
        >
          <div className="space-y-5">
            <OwnerActions
              entryId={entry.id}
              number={entry.number}
              rating={entry.rating}
              shortlisted={entry.isShortlisted}
              canAct={reviewing && entry.status === "active"}
              fileDays={fileDays}
              variant="panel"
            />
            <ScanPanel
              entryId={entry.id}
              unlocked={contest.logoScan}
              scan={scan ? { ...scan, createdAt: scan.createdAt.toISOString() } : null}
              unlockHref={base}
              price={formatTaka(prices.logo_scan, locale)}
            />
            <EntryComments entryId={entry.id} comments={entry.comments} canComment reason="notAllowed" loginHref="/login" maxLength={s["limits.contest_comment_max_length"]} />
          </div>
        </EntryViewer>
      )}
    </div>
  );
}

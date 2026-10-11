import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrandTile, ContestNumber, PackagePill, PRIZE_TEXT, StatusLine } from "@/components/contests/contest-bits";
import { EntryComments } from "@/components/entries/entry-comments";
import { Collage } from "@/components/entries/entry-card";
import { EntrySort } from "@/components/entries/entry-sort";
import { EntryViewer } from "@/components/entries/entry-viewer";
import { VoteButtons } from "@/components/entries/vote-buttons";
import { CopyClaim } from "@/components/claims/copy-claim";
import { ClientHandover } from "@/components/handover/client-handover";
import { HandoverTracker } from "@/components/handover/tracker";
import { AddonsPanel } from "@/components/manage/addons-panel";
import { OwnerActions } from "@/components/manage/owner-actions";
import { WinnerPopup } from "@/components/manage/winner-popup";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { BackLink } from "@/components/ui/back-link";
import { PageShell, Panel } from "@/components/ui/panel";
import { GlideTrack } from "@/components/ui/glide-track";
import { CountUp } from "@/components/ui/count-up";
import { StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import { WinnerBadge, WinnerTrophy } from "@/components/ui/trophy";
import { getCurrentUser } from "@/lib/auth/session";
import { CheckerBox, CheckCardAction } from "@/components/logo-check/checker-box";
import { CheckerProvider } from "@/components/logo-check/checker-context";
import { addonPrices } from "@/lib/contests/addon-payments";
import { contestChecks } from "@/lib/logo-check/queries";
import { checkerReady } from "@/lib/logo-check/start";
import { getContestBySlug } from "@/lib/contests/browse";
import { cx } from "@/lib/cx";
import { getEntryDetail, listEntries } from "@/lib/entries/queries";
import { isEntrySort, type EntrySort as EntrySortKey } from "@/lib/entries/rules";
import { latestClaim } from "@/lib/claims/queries";
import { canOpenClaim, claimWindowEnds } from "@/lib/claims/rules";
import { getHandoverByContest } from "@/lib/handover/queries";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
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
  // Order of the designs (owner, 2026-10-11): best rated first unless the client picks another.
  const sort: EntrySortKey = isEntrySort(sp.sort) ? sp.sort : "top";
  const listHref = (f: Filter, o: EntrySortKey) => {
    const q = [f !== "all" && `filter=${f}`, o !== "top" && `sort=${o}`].filter(Boolean).join("&");
    return q ? `${base}?${q}` : base;
  };
  const here = listHref(filter, sort);
  const withParam = (href: string, param: string) => `${href}${href.includes("?") ? "&" : "?"}${param}`;
  const [entries, prices, s, entry, handover, checks] = await Promise.all([
    listEntries(contest.id, entryContest, user, sort),
    addonPrices(),
    getSettings(["timers.designer_file_upload_days", "limits.contest_comment_max_length", "limits.max_revision_requests", "limits.approval_feedback_max_words", "timers.copy_claim_days"]),
    entryNumber ? getEntryDetail(contest.id, entryNumber, entryContest, user) : null,
    getHandoverByContest(contest.id),
    // AI copyright checker (owner, 2026-10-10): the client's checks for this contest.
    contestChecks({ id: contest.id, prize: contest.prize, logoScan: contest.logoScan, status: contest.rawStatus }),
  ]);
  const claim = handover ? await latestClaim(handover.id) : null;
  const checker = {
    contest: { id: contest.id, slug: contest.slug, brand: contest.brandName },
    designs: entries.filter((e) => e.status !== "rejected").map((e) => ({ id: e.id, number: e.number, coverUrl: e.previews[0] ?? null, designer: e.designer?.username ? `@${e.designer.username}` : (e.designer?.name ?? null) })),
    state: checks,
    ready: checkerReady(),
    lens: Boolean(process.env.SEARCHAPI_API_KEY),
  };
  const claimUntil = handover ? claimWindowEnds(handover.pickedAt, s["timers.copy_claim_days"]) : null;
  const claimable = handover ? canOpenClaim(handover, new Date(), s["timers.copy_claim_days"], claim?.status === "open") : false;
  const fileDays = s["timers.designer_file_upload_days"];
  const reviewing = contest.status === "open" || contest.status === "judging";
  const won = typeof sp.won === "string" ? (entries.find((e) => e.status === "winner" && e.number === Number(sp.won)) ?? null) : null;
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
    <PageShell>
      <BackLink href="/dashboard">{t("manage.back")}</BackLink>

      {sp.payment === "paid" && (
        <div>
          <Alert tone="success">{t("manage.payment.paid")}</Alert>
        </div>
      )}
      {sp.payment === "failed" && (
        <div>
          <Alert tone="danger">{t("manage.payment.failed")}</Alert>
        </div>
      )}

      {/* Header */}
      <Panel as="header" className="max-[720px]:py-6">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-[22px] ring-1 ring-line sm:size-24">
              <BrandTile name={contest.brandName} isPrivate={false} cover={contest.cover} flat className="h-full w-full text-[1.2rem]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={contest.status as ChipStatus} label={t(`status.${contest.status as ChipStatus}`)} />
                <PackagePill pkg={contest.package} t={t} />
                <ContestNumber n={contest.number} t={t} locale={locale} />
              </div>
              <h1 className="m-0 mt-2 truncate text-[clamp(28px,3.6vw,42px)] font-semibold leading-[1.1] tracking-[-0.035em] text-ink">{contest.brandName}</h1>
              <div className="mt-1 text-sm">
                <StatusLine contest={contest} now={new Date()} t={t} locale={locale} />
              </div>
            </div>
          </div>
          {/* Prize, Edit and Public page: three tiles of one size (owner, 2026-10-08) */}
          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-stretch">
            <div className="col-span-2 flex min-h-[5.5rem] flex-col justify-center rounded-[20px] bg-[#fff6d6] px-5 py-3 sm:min-w-44">
              <p className="m-0 text-xs font-bold text-gold-ink">{t("contest.stats.prize")}</p>
              <p className={cx("m-0 text-3xl font-semibold tabular-nums", PRIZE_TEXT)}><CountUp value={contest.prize} locale={locale} taka /></p>
            </div>
            {contest.status === "open" && (
              <Link
                href={`${base}/edit`}
                className="lc-g group relative flex min-h-[5.5rem] flex-col justify-between overflow-clip rounded-[20px] bg-[image:var(--gradient-red-dark)] px-4 py-3 text-white transition-[filter] duration-300 hover:brightness-110 sm:min-w-44"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-150"
                />
                <span className="relative flex size-8 items-center justify-center rounded-[10px] bg-white/15">
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
                "group relative flex min-h-[5.5rem] flex-col justify-between overflow-clip rounded-[20px] bg-chip px-4 py-3 text-ink transition-colors duration-300 hover:bg-line sm:min-w-44",
                contest.status !== "open" && "col-span-2",
              )}
            >
              <span className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-[10px] bg-surface text-primary">
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
        <dl className="relative m-0 mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map((st) => (
            <div key={st.label} className="flex flex-col-reverse rounded-[18px] bg-chip px-4 py-3">
              <dt className="mt-0.5 text-[13px] font-medium text-muted">{st.label}</dt>
              <dd className="lc-d m-0 text-2xl font-semibold tabular-nums tracking-[-0.03em] text-ink">{st.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {/* Lifecycle (BLUEPRINT §6): pick a winner by the deadline, or the contest ended with no result */}
      {contest.status === "judging" && contest.judgingEndsAt && (
        <p className="m-0 rounded-[20px] bg-[#fff6d6] px-5 py-4 font-semibold text-gold-ink">
          {t("lifecycle.pickBy", { date: formatDate(contest.judgingEndsAt, locale, "long") })}
        </p>
      )}
      {contest.status === "no_result" && <p className="m-0 rounded-[20px] bg-surface px-5 py-4 text-ink">{t("lifecycle.noResultClient")}</p>}

      {/* C-17 Final files: the handover after a winner is picked (owner, 2026-10-08) */}
      {handover && (
        <Panel className="max-[720px]:py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-[clamp(24px,2.8vw,32px)] font-semibold tracking-[-0.03em] text-ink">{t("handover.section")}</h2>
            <p className="text-sm text-muted">
              #{fmt(handover.entryNumber)} · {handover.designer.username ? `@${handover.designer.username}` : handover.designer.name}
            </p>
          </div>
          <div className="mt-4">
            <HandoverTracker status={handover.status} t={t} />
          </div>
          <div className="mt-5">
            <ClientHandover
              handoverId={handover.id}
              status={handover.status}
              // No result (§2): uploaded files are never released, so their links don't even reach the page.
              files={handover.status === "no_result" ? [] : handover.files}
              fontsNote={handover.fontsNote}
              dueAt={handover.dueAt.toISOString()}
              reviewDueAt={handover.reviewDueAt ? handover.reviewDueAt.toISOString() : null}
              revisionCount={handover.revisionCount}
              maxRevisions={s["limits.max_revision_requests"]}
              maxWords={s["limits.approval_feedback_max_words"]}
              rating={handover.rating}
            />
          </div>
          {/* Copy claim on the winning design (BLUEPRINT §7.6, owner 2026-10-09) */}
          {claimUntil && (claimable || claim) && (
            <div className="mt-5 border-t border-line pt-4">
              <CopyClaim
                handoverId={handover.id}
                canClaim={claimable}
                until={claimUntil.toISOString()}
                claim={claim ? { status: claim.status, outcome: claim.outcome, adminNote: claim.adminNote } : null}
              />
            </div>
          )}
        </Panel>
      )}

      {/* Review designs on the left, add-ons in a sidebar on the right (owner, 2026-10-08) */}
      <CheckerProvider setup={checker} lens={checker.lens}>
      <Panel tone="grey" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_23rem] max-[720px]:py-6">
        <section className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="m-0 text-[clamp(24px,2.8vw,32px)] font-semibold tracking-[-0.03em] text-ink">{t("manage.review.title")}</h2>
            <nav className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <GlideTrack className="w-max">
                <ul className="m-0 flex w-max list-none gap-1 rounded-[18px] bg-surface p-1 ring-1 ring-line">
                  {FILTERS.map((f) => (
                    <li key={f}>
                      <Link
                        href={listHref(f, sort)}
                        scroll={false}
                        aria-current={f === filter ? "page" : undefined}
                        className={cx(
                          "relative flex min-h-11 items-center gap-2 rounded-[14px] px-4 text-[15px] font-bold transition-colors",
                          f === filter ? "bg-ink text-white" : "text-muted hover:text-ink",
                        )}
                      >
                        {t(`manage.review.filters.${f}`)}
                        <span className={cx("rounded-full px-1.5 text-xs tabular-nums", f === filter ? "bg-white/15" : "bg-chip")}>{fmt(counts[f])}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </GlideTrack>
            </nav>
          </div>

          {shown.length > 1 && (
            <div className="mt-4">
              <EntrySort current={sort} href={(o) => listHref(filter, o)} t={t} tone="surface" />
            </div>
          )}
          {shown.length > 0 ? (
            <ul className="m-0 mt-5 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 sm:gap-3.5">
              {shown.map((e) => (
                <li
                  key={e.id}
                  className={cx(
                    "lc-rv-soft overflow-hidden rounded-[22px] bg-surface ring-1 transition-shadow hover:shadow-card",
                    e.status === "winner" ? "ring-2 ring-primary" : "ring-line",
                  )}
                >
                  <Link
                    href={withParam(here, `entry=${e.number}`)}
                    scroll={false}
                    className="relative block"
                    aria-label={t("entry.open", { n: fmt(e.number) })}
                  >
                    <Collage previews={e.previews} total={e.imageCount} />
                    {e.status === "winner" && (
                      <>
                        <WinnerBadge label={t("entry.winner")} className="absolute left-2.5 top-2.5" />
                        <WinnerTrophy className="absolute right-2.5 top-2.5" />
                      </>
                    )}
                    {e.isShortlisted && e.status !== "rejected" && e.status !== "winner" && (
                      <span className="absolute left-2 top-2 rounded-full bg-[image:var(--gradient-red)] px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">
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
                        wonHref={withParam(here, `won=${e.number}`)}
                      />
                      <CheckCardAction entryId={e.id} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6">
              <EmptyState title={t("manage.review.empty")} />
            </div>
          )}
        </section>

        <aside id="addons" className="flex scroll-mt-32 flex-col gap-3 lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:rounded-[28px] lg:[scrollbar-width:thin]">
          <CheckerBox />
          <div className="lc-card shrink-0 overflow-hidden p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="lc-g flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[image:var(--gradient-red-icon)] text-white">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
                </svg>
              </span>
              <div className="min-w-0">
                <h2 className="m-0 text-lg font-semibold leading-tight text-ink">{t("dashboard.addons")}</h2>
                <p className="m-0 mt-0.5 text-[13px] text-muted">{t("manage.addons.subtitle")}</p>
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
                prize={contest.prize}
              />
            </div>
          </div>
        </aside>
      </Panel>

      {/* C-15: one design with the owner tools */}
      {entry && (
        <EntryViewer
          number={entry.number}
          images={entry.previews}
          winner={entry.status === "winner"}
          closeHref={here}
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
              wonHref={withParam(here, `won=${entry.number}`)}
            />
            {/* Like and dislike (owner, 2026-10-11): the client votes on designs in their own contest */}
            <VoteButtons entryId={entry.id} up={entry.upVotes} down={entry.downVotes} mine={entry.myVote} canVote />
            <EntryComments entryId={entry.id} comments={entry.comments} canComment reason="notAllowed" loginHref="/login" maxLength={s["limits.contest_comment_max_length"]} />
          </div>
        </EntryViewer>
      )}

      {/* C-16 (owner, 2026-10-11): "You picked a winner" with the AI copyright checker and Go to dashboard */}
      {won && !entry && (
        <WinnerPopup
          entryId={won.id}
          number={won.number}
          brand={contest.brandName}
          designer={won.designer ? (won.designer.username ? `@${won.designer.username}` : won.designer.name) : null}
          cover={won.previews[0] ?? null}
          fileDays={fileDays}
          closeHref={here}
        />
      )}
      </CheckerProvider>
    </PageShell>
  );
}

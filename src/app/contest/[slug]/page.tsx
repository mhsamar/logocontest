import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestBrief } from "@/components/contests/contest-brief";
import { NdaGate } from "@/components/contests/nda-gate";
import { BrandTile, ContestBadges, ContestNumber, LockIcon, contestTitle } from "@/components/contests/contest-bits";
import { ContestComments } from "@/components/contests/contest-comments";
import { ContestStats } from "@/components/contests/contest-stats";
import { EntryCard } from "@/components/entries/entry-card";
import { EntryComments } from "@/components/entries/entry-comments";
import { EntryViewer } from "@/components/entries/entry-viewer";
import { ReportButton } from "@/components/entries/report-button";
import { SaveButton } from "@/components/contests/save-button";
import { ShareContest } from "@/components/contests/share-contest";
import { UsedOnIcon } from "@/components/contests/used-on-icon";
import { ButtonLink } from "@/components/ui/button";
import { PageShell } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { Avatar } from "@/components/ui/avatar";
import { TrophyIcon } from "@/components/ui/trophy";
import { getCurrentUser } from "@/lib/auth/session";
import { getContestBySlug, type ContestDetail } from "@/lib/contests/browse";
import { contestTimeline } from "@/lib/contests/browse-query";
import { formatDate } from "@/lib/dates";
import { countComments, listComments, savedContestIds } from "@/lib/contests/community";
import { cx } from "@/lib/cx";
import { contestDesigners, getEntryDetail, hasEntryIn, listEntries } from "@/lib/entries/queries";
import { entryScope } from "@/lib/entries/rules";
import { siteOrigin } from "@/lib/email";
import { LikeButton } from "@/components/rewards/like-button";
import { getI18n } from "@/lib/i18n/server";
import { canLike } from "@/lib/rewards/rules";
import { contestIndexable, openGraphFor } from "@/lib/seo";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { getSetting } from "@/lib/settings";
import { can, type CurrentUser } from "@/lib/auth/policies";

export async function generateMetadata({ params }: PageProps<"/contest/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const contest = await getContestBySlug(slug, user);
  if (!contest) return { title: t("notFound.title"), robots: { index: false } };
  const title = contestTitle(contest, t);
  const description = contest.brief?.description.slice(0, 160);
  return {
    title,
    description,
    openGraph: openGraphFor({ title, description, path: `/contest/${contest.slug}`, locale }),
    alternates: { canonical: `/contest/${contest.slug}` },
    // Private and NDA contests, and anything not yet live, are hidden from search engines (BLUEPRINT §15.1).
    robots: contestIndexable({ status: contest.rawStatus, isPrivate: contest.isPrivate, isNda: contest.isNda }) ? undefined : { index: false },
  };
}

/** The main button changes with the viewer (UI-JOURNEY P-03). */
/** Small uppercase label above a fact on this page. */
const LABEL = "m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted";

function primaryAction(contest: ContestDetail, user: CurrentUser | null, t: Translate) {
  const open = contest.status === "open";
  if (contest.isOwner) return { href: `/dashboard/contests/${contest.slug}`, label: t("dashboard.manage") };
  if (open && !user) return { href: `/login?next=${encodeURIComponent(`/contest/${contest.slug}`)}`, label: t("contest.actions.login") };
  if (open && user?.role === "designer") return { href: `/contest/${contest.slug}/submit`, label: t("contest.actions.submit") };
  return { href: "/start", label: t("contest.actions.own") };
}

// P-03 Contest detail
export default async function ContestPage({ params, searchParams }: PageProps<"/contest/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const contest = await getContestBySlug(slug, user);
  if (!contest) notFound();

  const now = new Date();
  const action = primaryAction(contest, user, t);
  const entryContest = { ownerId: contest.ownerId, isBlind: contest.isBlind, canSeeBrief: contest.canSeeBrief, status: contest.status, winnerIsPublic: contest.winnerIsPublic };
  // Blind contests: designers still see their own designs (UI-JOURNEY P-03).
  const blindHidden = contest.isBlind && entryScope(entryContest, user).kind === "none";
  // Owner, 2026-10-10: opening a contest always shows its designs first (an empty list says so).
  const defaultTab = "entries";
  const tab = sp.tab === "entries" || sp.tab === "brief" || sp.tab === "comments" ? sp.tab : defaultTab;
  const canSave = can(user, "contest.save");
  const entryNumber = tab === "entries" && typeof sp.entry === "string" ? Number(sp.entry) : null;
  const [judgingDays, commentCount, saved, comments, commentMax, entries, entry, viewerHasEntry, designers, fileDays] = await Promise.all([
    getSetting("timers.judging_window_days"),
    contest.canSeeBrief ? countComments(contest.id) : 0,
    canSave ? savedContestIds(user?.id, [contest.id]) : new Set<string>(),
    tab === "comments" && contest.canSeeBrief ? listComments(contest.id, contest.ownerId, user) : [],
    getSetting("limits.contest_comment_max_length"),
    // Also used for the strip of designs in the header.
    !blindHidden ? listEntries(contest.id, entryContest, user) : [],
    entryNumber ? getEntryDetail(contest.id, entryNumber, entryContest, user) : null,
    user?.role === "designer" ? hasEntryIn(contest.id, user.id) : false,
    contestDesigners(contest.id, 5),
    getSetting("timers.designer_file_upload_days"),
  ]);
  const fmt = (n: number) => formatNumber(n, locale);
  const contestUrl = `${await siteOrigin()}/contest/${contest.slug}`;
  const entriesHref = `/contest/${contest.slug}?tab=entries`;
  const loginHref = `/login?next=${encodeURIComponent(`/contest/${contest.slug}?tab=comments`)}`;
  const statusKnown = contest.rawStatus === contest.status;

  const judgingEnds = contestTimeline(contest, judgingDays, now)[1]?.endsAt ?? null;
  const facts: [string, string][] = [
    ...(contest.startsAt ? [[t("contest.facts.started"), formatDate(contest.startsAt, locale, "short")] as [string, string]] : []),
    ...(contest.endsAt ? [[t("contest.facts.entriesClose"), formatDate(contest.endsAt, locale, "short")] as [string, string]] : []),
    ...(judgingEnds ? [[t("contest.facts.winnerBy"), formatDate(judgingEnds, locale, "short")] as [string, string]] : []),
    [t("contest.facts.visibility"), t(contest.isPrivate ? "contest.facts.private" : contest.isBlind ? "contest.facts.blind" : "contest.facts.public")],
    [t("contest.facts.files"), t("contest.facts.filesValue", { days: fmt(fileDays) })],
  ];

  return (
    <PageShell>
      {!statusKnown && <p className="m-0 rounded-[20px] bg-[#FFEDD5] px-5 py-3.5 text-[15px] font-medium text-[#9A3412]">{t("contest.ownerNote")}</p>}

      {/* Header panel */}
      <section className="grid gap-8 rounded-[32px] bg-surface p-5 sm:p-8 lg:grid-cols-[1fr_400px] lg:gap-10 lg:p-10 max-[720px]:rounded-[24px]">
        <div className="flex min-w-0 flex-col">
          {/* Title block */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="lc-ph size-20 shrink-0 rounded-[22px] sm:size-24">
              <BrandTile name={contest.brandName} isPrivate={contest.isPrivate && !contest.canSeeBrief} cover={contest.cover} flat className="h-full w-full text-[1.1rem] sm:text-[1.3rem]" />
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={statusKnown ? contest.status : (contest.rawStatus as "draft")} label={t(`status.${contest.rawStatus as "draft"}`)} />
                <ContestNumber n={contest.number} t={t} locale={locale} />
                <ContestBadges contest={contest} t={t} />
              </div>
              <h1 className="m-0 mt-2.5 break-words text-[clamp(30px,4vw,48px)] font-semibold leading-[1.05] tracking-[-0.04em] text-ink">
                {contest.canSeeBrief ? contest.brandName : t("contest.privateTitle")}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-chip px-3 py-1 font-semibold text-ink">{t(`wizard.businessTypes.${contest.businessType}`)}</span>
                <span className="rounded-full bg-chip px-3 py-1 font-semibold text-ink">
                  {t("browse.packageName", { name: t(`wizard.packages.${contest.package}.name`) })}
                </span>
                {contest.client && (
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-bold text-white" aria-hidden>
                      {contest.client.name.trim().charAt(0).toUpperCase()}
                    </span>
                    {t("contest.by", { name: contest.client.name })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {contest.brief ? (
            <p className="m-0 mt-6 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-muted">{contest.brief.description}</p>
          ) : contest.isNda && user ? (
            <NdaGate contestId={contest.id} viewer={user.role === "designer" ? "designer" : "other"} loginHref={`/login?as=designer&next=${encodeURIComponent(`/contest/${contest.slug}`)}`} />
          ) : contest.isNda ? (
            <NdaGate contestId={contest.id} viewer="guest" loginHref={`/login?as=designer&next=${encodeURIComponent(`/contest/${contest.slug}`)}`} />
          ) : (
            <p className="mt-6 flex items-center gap-2 text-muted">
              <LockIcon />
              {t("contest.privateBody")}
            </p>
          )}

          {/* At a glance (owner, 2026-10-08): who is taking part and what the winner gets — the designs themselves are in the tabs below */}
          <div className="mt-7">
            <div className="relative overflow-hidden rounded-[24px] bg-frame p-5">
              <TrophyIcon className="pointer-events-none absolute -bottom-4 -right-4 size-24 opacity-15" />
              <span className="inline-flex rounded-full bg-gold px-2.5 py-1 text-[13px] font-bold text-gold-ink">{t("contest.glance.winnerTitle")}</span>
              <ul className="m-0 mt-3.5 grid list-none gap-2.5 p-0 text-[15px] text-ink sm:grid-cols-3 sm:gap-4">
                {[t("contest.glance.paid"), t("contest.glance.files", { days: fmt(fileDays) }), t("contest.glance.copyright")].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-white" aria-hidden>
                      <svg viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="3.5">
                        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* What the client wants (owner, 2026-10-10: one tidy card with no empty middle; the full brief is in the Brief tab) */}
          {contest.brief && (
            <div className="lc-card mt-3.5 !rounded-[24px] p-5">
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                <div className="min-w-0">
                  <p className={LABEL}>{t("contest.brief.logoText")}</p>
                  <p className="lc-d m-0 mt-1.5 truncate text-2xl font-semibold tracking-[-0.03em] text-ink">{contest.brief.logoText || contest.brandName}</p>
                  {contest.brief.slogan && <p className="truncate text-sm text-muted">{contest.brief.slogan}</p>}
                </div>
                {contest.brief.styles.length > 0 && (
                  <div className="min-w-0">
                    <p className={LABEL}>{t("contest.brief.styles")}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {contest.brief.styles.map((st) => (
                        <span key={st} className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 text-sm font-semibold text-primary">
                          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                          {t(`wizard.styles.${st}`)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="min-w-0">
                  <p className={LABEL}>{t("contest.brief.colors")}</p>
                  {contest.brief.colors.length > 0 ? (
                    <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                      {contest.brief.colors.map((hex) => (
                        <li key={hex} className="flex flex-col items-center gap-1">
                          <span className="size-9 rounded-xl shadow-card ring-1 ring-black/10" style={{ background: hex }} />
                          <span className="font-mono text-[0.625rem] uppercase text-muted">{hex.replace("#", "")}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 mt-1.5 text-sm text-ink">{t("contest.brief.designersChoose")}</p>
                  )}
                </div>
              </div>

              {contest.brief.usedOn.length > 0 && (
                <div className="mt-5 border-t border-line pt-5">
                  <p className={LABEL}>{t("contest.glance.usedTitle")}</p>
                  <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                    {contest.brief.usedOn.map((u) => (
                      <li key={u} className="inline-flex items-center gap-1.5 rounded-full bg-chip py-1 pl-1 pr-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-primary">
                          <UsedOnIcon kind={u} />
                        </span>
                        <span className="text-[0.8125rem] font-medium text-ink">{t(`wizard.usedOn.${u}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(contest.brief.targetAudience || contest.brief.requirements.length > 0) && (
                <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
                  {contest.brief.targetAudience && (
                    <div className="min-w-0">
                      <p className={LABEL}>{t("contest.brief.audience")}</p>
                      <p className="m-0 mt-1.5 line-clamp-3 text-[15px] leading-relaxed text-ink">{contest.brief.targetAudience}</p>
                    </div>
                  )}
                  {contest.brief.requirements.length > 0 && (
                    <div className="min-w-0">
                      <p className={LABEL}>{t("contest.brief.requirements")}</p>
                      <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[15px] text-ink">
                        {contest.brief.requirements.slice(0, 4).map((r) => (
                          <li key={r} className="flex items-start gap-2">
                            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                            {t(`wizard.requirements.${r}`)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <Link href={`/contest/${contest.slug}?tab=brief#tabs`} scroll={false} className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary hover:underline">
                {t("contest.brief.readFull")}
                <span aria-hidden>→</span>
              </Link>
            </div>
          )}
        </div>

        <ContestStats
          contest={contest}
          judgingDays={judgingDays}
          now={now}
          action={
            <div className="space-y-2.5">
              <ButtonLink href={action.href} size="lg" block>
                {action.label}
              </ButtonLink>
              {canSave && <SaveButton contestId={contest.id} saved={saved.has(contest.id)} variant="button" />}

              {/* Who is taking part, and sharing (owner, 2026-10-08) */}
              <div className="mt-2 space-y-4 border-t border-line pt-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("contest.glance.designersTitle")}</p>
                  {designers.total > 0 ? (
                    <div className="mt-2 flex items-center gap-3">
                      {contest.isBlind && !contest.isOwner ? (
                        <span className="flex size-9 items-center justify-center rounded-full bg-ink text-cream ring-2 ring-white">
                          <LockIcon className="size-4" />
                        </span>
                      ) : (
                        <div className="flex">
                          {designers.list.map((d, i) => (
                            <Avatar key={`${d.username ?? d.name}-${i}`} name={d.name} url={d.avatarUrl} tone="cream" className={cx("size-9 text-xs ring-2 ring-white", i > 0 && "-ml-2.5")} />
                          ))}
                          {designers.total > designers.list.length && (
                            <span className="-ml-2.5 flex size-9 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-bold text-white ring-2 ring-white">+{fmt(designers.total - designers.list.length)}</span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-ink">
                        <span className="font-semibold">{designers.total === 1 ? t("contest.glance.oneDesigner") : t("contest.glance.designers", { n: fmt(designers.total) })}</span>
                        {contest.isBlind && !contest.isOwner && <span className="block text-xs text-muted">{t("contest.glance.blindNames")}</span>}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm text-muted">{t("contest.glance.noDesignersLine")}</p>
                  )}
                </div>
                <ShareContest url={contestUrl} brand={contest.canSeeBrief ? contest.brandName : t("contest.privateTitle")} />
              </div>
            </div>
          }
          footer={
            // Key facts at the bottom of the card, so it has no empty space under Share (owner, 2026-10-10).
            <div>
              <p className={LABEL}>{t("contest.facts.title")}</p>
              <dl className="m-0 mt-2 divide-y divide-line rounded-[16px] bg-surface px-4 text-sm ring-1 ring-line">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-muted">{label}</dt>
                    <dd className="m-0 text-right font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              {contest.canSeeBrief && (
                <Link href={`/contest/${contest.slug}?tab=comments#tabs`} scroll={false} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                  {t("contest.facts.ask")}
                  <span aria-hidden>→</span>
                </Link>
              )}
            </div>
          }
        />
      </section>

      {/* Tabs and their content in one panel */}
      <section id="tabs" className="scroll-mt-28 rounded-[32px] bg-surface p-5 sm:p-8 lg:p-10 max-[720px]:rounded-[24px]">
      <nav aria-label={t("contest.tabs.label")} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
        <ul className="m-0 flex w-max list-none gap-1 rounded-[18px] bg-chip p-1">
          {(["entries", "brief", "comments"] as const).map((key) => (
            <li key={key}>
              <Link
                href={`/contest/${contest.slug}?tab=${key}`}
                scroll={false}
                aria-current={tab === key ? "page" : undefined}
                className={cx("flex min-h-11 items-center gap-2 rounded-[14px] px-4 text-[15px] font-semibold transition-colors", tab === key ? "bg-ink text-white" : "text-muted hover:text-ink")}
              >
                {t(`contest.tabs.${key}`)}
                {(key === "entries" ? !blindHidden : key === "comments") && (
                  <span className={cx("rounded-full px-1.5 text-xs tabular-nums", tab === key ? "bg-white/15" : "bg-white")}>
                    {formatNumber(key === "entries" ? contest.entries : commentCount, locale)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-7">
        {tab === "comments" ? (
          contest.canSeeBrief ? (
            <ContestComments
              contestId={contest.id}
              comments={comments}
              canComment={can(user, "contest.comment", { contestOwnerId: contest.ownerId })}
              loginHref={user ? null : loginHref}
              maxLength={commentMax}
            />
          ) : (
            <div className="mx-auto max-w-xl">
              <EmptyState
                icon={<LockIcon className="size-6" />}
                title={t("contest.privateTitle")}
                body={t("contest.privateBody")}
                action={<ButtonLink href={loginHref}>{t("nav.login")}</ButtonLink>}
              />
            </div>
          )
        ) : tab === "brief" ? (
          contest.brief ? (
            <ContestBrief brief={contest.brief} />
          ) : (
            <div className="mx-auto max-w-xl">
              <EmptyState
                icon={<LockIcon className="size-6" />}
                title={t("contest.privateTitle")}
                body={t("contest.privateBody")}
                action={<ButtonLink href={`/login?next=${encodeURIComponent(`/contest/${contest.slug}`)}`}>{t("nav.login")}</ButtonLink>}
              />
            </div>
          )
        ) : blindHidden ? (
          <div className="mx-auto max-w-xl">
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7a10 10 0 0 1-2.4 3.4M6.6 6.6C4.3 8 3 10.4 3 12c0 2 4 7 9 7a9.7 9.7 0 0 0 4.1-.9" strokeLinecap="round" />
                </svg>
              }
              title={t("contest.blind")}
            />
          </div>
        ) : entries.length > 0 ? (
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-4">
            {entries.map((e) => (
              <li key={e.id} className="lc-rv-soft">
                <EntryCard entry={e} href={`${entriesHref}&entry=${e.number}`} t={t} fmt={fmt} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mx-auto max-w-xl">
            <EmptyState
              title={t("contest.noEntriesTitle")}
              body={t("contest.noEntriesBody")}
              action={user?.role === "designer" && contest.status === "open" ? <ButtonLink href={`/contest/${contest.slug}/submit`}>{t("contest.actions.submit")}</ButtonLink> : undefined}
            />
          </div>
        )}
      </div>

      </section>

      {/* P-04: one design, every mockup and its comments */}
      {entry && (
        <EntryViewer
          number={entry.number}
          images={entry.previews}
          winner={entry.status === "winner"}
          closeHref={entriesHref}
          byline={entry.designer ? t("entry.by", { name: entry.designer.username ? `@${entry.designer.username}` : entry.designer.name }) : t("entry.hiddenName")}
        >
          {/* Likes on the winning design, next to its stars (owner, 2026-10-09) */}
          {entry.status === "winner" && contest.status === "completed" && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-[#fff7e0] px-4 py-3 ring-1 ring-[#f4d58a]">
              {entry.rating ? <span className="text-[#c99512]">{"★".repeat(entry.rating)}</span> : null}
              <LikeButton entryId={entry.id} likes={entry.likes} liked={entry.liked} canLike={canLike(user, entry.designerId)} />
              <span className="text-xs text-muted">{t(canLike(user, entry.designerId) ? "likes.hint" : "likes.designersOnly")}</span>
            </div>
          )}
          <EntryComments
            entryId={entry.id}
            comments={entry.comments}
            canComment={can(user, "entry.comment", { contestOwnerId: contest.ownerId, isBlind: contest.isBlind, entryDesignerId: entry.designerId, viewerHasEntry })}
            reason={!user ? "login" : user.role === "designer" && !viewerHasEntry ? "submitFirst" : "notAllowed"}
            loginHref={`/login?next=${encodeURIComponent(`${entriesHref}&entry=${entry.number}`)}`}
            maxLength={commentMax}
          />
          {!entry.mine && (
            <div className="mt-5 border-t border-line pt-2">
              <ReportButton entryId={entry.id} number={entry.number} loginHref={user ? null : `/login?next=${encodeURIComponent(`${entriesHref}&entry=${entry.number}`)}`} />
            </div>
          )}
        </EntryViewer>
      )}
    </PageShell>
  );
}

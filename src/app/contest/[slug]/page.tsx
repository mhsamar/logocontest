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
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { Avatar } from "@/components/ui/avatar";
import { TrophyIcon } from "@/components/ui/trophy";
import { getCurrentUser } from "@/lib/auth/session";
import { getContestBySlug, type ContestDetail } from "@/lib/contests/browse";
import { countComments, listComments, savedContestIds } from "@/lib/contests/community";
import { cx } from "@/lib/cx";
import { contestDesigners, getEntryDetail, hasEntryIn, listEntries } from "@/lib/entries/queries";
import { entryScope } from "@/lib/entries/rules";
import { siteOrigin } from "@/lib/email";
import { getI18n } from "@/lib/i18n/server";
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
  // Entries first when there is something to show, otherwise the brief (UI-JOURNEY P-03).
  const defaultTab = contest.entries > 0 && !blindHidden ? "entries" : "brief";
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

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      {!statusKnown && (
        <p className="mb-4 rounded-lg bg-warning/10 px-4 py-3 text-sm text-ink ring-1 ring-warning/20">{t("contest.ownerNote")}</p>
      )}

      {/* Header panel */}
      <section className="grid gap-6 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-8 lg:grid-cols-[1fr_400px] lg:gap-10">
        <div className="flex min-w-0 flex-col">
          {/* Title block */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="size-20 shrink-0 overflow-hidden rounded-2xl shadow-raised ring-4 ring-white sm:size-24">
              <BrandTile name={contest.brandName} isPrivate={contest.isPrivate && !contest.canSeeBrief} cover={contest.cover} flat className="h-full w-full text-[1.1rem] sm:text-[1.3rem]" />
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={statusKnown ? contest.status : (contest.rawStatus as "draft")} label={t(`status.${contest.rawStatus as "draft"}`)} />
                <ContestNumber n={contest.number} t={t} locale={locale} />
                <ContestBadges contest={contest} t={t} />
              </div>
              <h1 className="mt-2 break-words text-h1 font-bold leading-tight tracking-tight text-ink lg:text-[2.5rem]">
                {contest.canSeeBrief ? contest.brandName : t("contest.privateTitle")}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink ring-1 ring-line">{t(`wizard.businessTypes.${contest.businessType}`)}</span>
                <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink ring-1 ring-line">
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
            <p className="mt-6 max-w-2xl whitespace-pre-line border-l-2 border-primary/30 pl-4 text-[1.0625rem] leading-relaxed text-ink/85">{contest.brief.description}</p>
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
            <div className={cx("relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#fffaf0] via-[#fff3d6] to-[#ffe6ad] p-4 ring-1 ring-[#f1c75c]/60 sm:p-5")}>
              <TrophyIcon className="pointer-events-none absolute -bottom-4 -right-4 size-24 opacity-20" />
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#8a5105]">{t("contest.glance.winnerTitle")}</p>
              <ul className="mt-3 grid gap-2 text-sm text-ink sm:grid-cols-3 sm:gap-4">
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

          {/* What the client wants */}
          {contest.brief && (
            <div className="mt-4 grid grid-cols-2 gap-5 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5 xl:grid-cols-[auto_1fr_auto] xl:gap-8">
              {(contest.brief.logoText || contest.brandName) && (
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">{t("contest.brief.logoText")}</p>
                  <p className="mt-1.5 truncate font-display text-2xl italic text-ink">{contest.brief.logoText || contest.brandName}</p>
                  {contest.brief.slogan && <p className="truncate text-sm text-muted">{contest.brief.slogan}</p>}
                </div>
              )}
              {contest.brief.styles.length > 0 && (
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">{t("contest.brief.styles")}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {contest.brief.styles.map((st) => (
                      <span key={st} className="inline-flex items-center gap-1.5 rounded-full bg-cream/60 px-3 py-1 text-sm font-medium text-primary-dark">
                        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                        {t(`wizard.styles.${st}`)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {contest.brief.usedOn.length > 0 && (
                <div className={cx("min-w-0", contest.brief.colors.length > 0 ? "col-span-2 sm:col-span-1 xl:col-span-2" : "col-span-2 xl:col-span-3")}>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">{t("contest.glance.usedTitle")}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {contest.brief.usedOn.map((u) => (
                      <li key={u} className="inline-flex items-center gap-1.5 rounded-full bg-canvas py-1 pl-1 pr-3 ring-1 ring-line">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UsedOnIcon kind={u} />
                        </span>
                        <span className="text-[0.8125rem] font-medium text-ink">{t(`wizard.usedOn.${u}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {contest.brief.colors.length > 0 && (
                <div className={cx(contest.brief.usedOn.length > 0 ? "col-span-2 sm:col-span-1" : "col-span-2 xl:col-span-1")}>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">{t("contest.brief.colors")}</p>
                  <ul className="mt-2 flex gap-2">
                    {contest.brief.colors.map((hex) => (
                      <li key={hex} className="flex flex-col items-center gap-1">
                        <span className="size-9 rounded-xl shadow-card ring-1 ring-black/10" style={{ background: hex }} />
                        <span className="font-mono text-[0.625rem] uppercase text-muted">{hex.replace("#", "")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
        />
      </section>

      {/* Tabs */}
      <nav aria-label={t("contest.tabs.label")} className="mt-8 border-b border-line">
        <ul className="flex gap-6">
          {(["entries", "brief", "comments"] as const).map((key) => (
            <li key={key}>
              <Link
                href={`/contest/${contest.slug}?tab=${key}`}
                scroll={false}
                aria-current={tab === key ? "page" : undefined}
                className={cx(
                  "-mb-px flex min-h-11 items-center gap-2 border-b-2 text-sm font-semibold transition-colors",
                  tab === key ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t(`contest.tabs.${key}`)}
                {(key === "entries" ? !blindHidden : key === "comments") && (
                  <span className="rounded-full bg-canvas px-1.5 text-xs tabular-nums text-muted">
                    {formatNumber(key === "entries" ? contest.entries : commentCount, locale)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6">
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
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {entries.map((e) => (
              <li key={e.id}>
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

      {/* P-04: one design, every mockup and its comments */}
      {entry && (
        <EntryViewer
          number={entry.number}
          images={entry.previews}
          closeHref={entriesHref}
          byline={entry.designer ? t("entry.by", { name: entry.designer.username ? `@${entry.designer.username}` : entry.designer.name }) : t("entry.hiddenName")}
        >
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
    </div>
  );
}

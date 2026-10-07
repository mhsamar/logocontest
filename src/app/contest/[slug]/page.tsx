import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestBrief } from "@/components/contests/contest-brief";
import { BrandTile, ContestBadges, LockIcon, contestTitle } from "@/components/contests/contest-bits";
import { ContestComments } from "@/components/contests/contest-comments";
import { ContestStats } from "@/components/contests/contest-stats";
import { SaveButton } from "@/components/contests/save-button";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { getCurrentUser } from "@/lib/auth/session";
import { getContestBySlug, type ContestDetail } from "@/lib/contests/browse";
import { countComments, listComments, savedContestIds } from "@/lib/contests/community";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { getSetting } from "@/lib/settings";
import { can, type CurrentUser } from "@/lib/auth/policies";

export async function generateMetadata({ params }: PageProps<"/contest/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const contest = await getContestBySlug(slug, user);
  if (!contest) return { title: t("notFound.title"), robots: { index: false } };
  return {
    title: contestTitle(contest, t),
    description: contest.brief?.description.slice(0, 160),
    // Private contests are hidden from search engines (upgrade description).
    robots: contest.isPrivate || contest.rawStatus !== contest.status ? { index: false } : undefined,
  };
}

/** The main button changes with the viewer (UI-JOURNEY P-03). */
function primaryAction(contest: ContestDetail, user: CurrentUser | null, t: Translate) {
  const open = contest.status === "open";
  if (contest.isOwner) return { href: `/contest/${contest.slug}?tab=entries`, label: t("contest.actions.review") };
  if (open && !user) return { href: `/login?next=${encodeURIComponent(`/contest/${contest.slug}`)}`, label: t("contest.actions.login") };
  // TODO(milestone 4): D-04 Submit a design.
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
  const blindHidden = contest.isBlind && !contest.isOwner;
  // Entries first when there is something to show, otherwise the brief (UI-JOURNEY P-03).
  const defaultTab = contest.entries > 0 && !blindHidden ? "entries" : "brief";
  const tab = sp.tab === "entries" || sp.tab === "brief" || sp.tab === "comments" ? sp.tab : defaultTab;
  const canSave = can(user, "contest.save");
  const [judgingDays, commentCount, saved, comments, commentMax] = await Promise.all([
    getSetting("timers.judging_window_days"),
    contest.canSeeBrief ? countComments(contest.id) : 0,
    canSave ? savedContestIds(user?.id, [contest.id]) : new Set<string>(),
    tab === "comments" && contest.canSeeBrief ? listComments(contest.id, contest.ownerId, user) : [],
    getSetting("limits.contest_comment_max_length"),
  ]);
  const loginHref = `/login?next=${encodeURIComponent(`/contest/${contest.slug}?tab=comments`)}`;
  const statusKnown = contest.rawStatus === contest.status;

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      {!statusKnown && (
        <p className="mb-4 rounded-lg bg-warning/10 px-4 py-3 text-sm text-ink ring-1 ring-warning/20">{t("contest.ownerNote")}</p>
      )}

      {/* Header panel */}
      <section className="grid gap-6 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-8 lg:grid-cols-[1fr_400px] lg:gap-10">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <BrandTile name={contest.brandName} isPrivate={contest.isPrivate && !contest.canSeeBrief} className="size-16 text-[0.9rem] sm:size-20 sm:text-[1.1rem]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={statusKnown ? contest.status : (contest.rawStatus as "draft")} label={t(`status.${contest.rawStatus as "draft"}`)} />
                <ContestBadges contest={contest} t={t} />
              </div>
              <h1 className="mt-2 break-words text-h1 font-bold leading-tight tracking-tight text-ink lg:text-[2.25rem]">
                {contest.canSeeBrief ? contest.brandName : t("contest.privateTitle")}
              </h1>
              <p className="mt-1 text-muted">
                {t(`wizard.businessTypes.${contest.businessType}`)} · {t("browse.packageName", { name: t(`wizard.packages.${contest.package}.name`) })}
              </p>
            </div>
          </div>

          {contest.client && <p className="mt-5 text-sm text-muted">{t("contest.by", { name: contest.client.name })}</p>}

          {contest.brief ? (
            <p className="mt-3 max-w-2xl whitespace-pre-line leading-relaxed text-ink">{contest.brief.description}</p>
          ) : (
            <p className="mt-5 flex items-center gap-2 text-muted">
              <LockIcon />
              {t("contest.privateBody")}
            </p>
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
        ) : (
          // TODO(milestone 4): entry cards (P-03 Entries tab, UI-JOURNEY §1.3 entry card).
          <div className="mx-auto max-w-xl">
            <EmptyState title={t("contest.noEntriesTitle")} body={t("contest.noEntriesBody")} />
          </div>
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound, redirect } from "next/navigation";
import { BriefBanner } from "@/components/client/brief-banner";
import { CwIcon } from "@/components/client/icons";
import { BasicChip, CheckChip, Empty, Picture, ProChip, ProOnPicture, Stars, StatusPill } from "@/components/client/parts";
import { ShortlistHeart } from "@/components/client/review-buttons";
import { ClientAvatar } from "@/components/client/avatar-menu";
import { CopyClaim } from "@/components/claims/copy-claim";
import { GuaranteeBanner, GuaranteeCard } from "@/components/guarantee/guarantee-status";
import { ContestBrief } from "@/components/contests/contest-brief";
import { ServiceBrief } from "@/components/services/service-brief";
import { NavScroll } from "@/components/ui/nav-scroll";
import { EntryComments } from "@/components/entries/entry-comments";
import { EntryViewer } from "@/components/entries/entry-viewer";
import { ShareButtons } from "@/components/share/share-buttons";
import { VoteButtons } from "@/components/entries/vote-buttons";
import { ClientHandover } from "@/components/handover/client-handover";
import { HandoverChat } from "@/components/handover/handover-chat";
import { HandoverTracker } from "@/components/handover/tracker";
import { CheckerBox, CheckCardAction } from "@/components/logo-check/checker-box";
import { CheckerProvider } from "@/components/logo-check/checker-context";
import { PurchasePixel } from "@/components/analytics/purchase-pixel";
import { freshPurchase } from "@/lib/analytics/meta-pixel";
import { CheckLegend, ReportPanel } from "@/components/logo-check/judging";
import { AddonsPanel } from "@/components/manage/addons-panel";
import { OwnerActions } from "@/components/manage/owner-actions";
import { WinnerPopup } from "@/components/manage/winner-popup";
import { MessageDesignerLink } from "@/components/pro/message-designer";
import { hasPermission } from "@/lib/admin/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { latestClaim } from "@/lib/claims/queries";
import { canOpenClaim, claimWindowEnds } from "@/lib/claims/rules";
import { contestHref, contestStages, contestTab, CONTEST_TABS, designFilter, DESIGN_FILTERS, leftParts, mainAction, stagesFor, type ContestTab } from "@/lib/client/rules";
import { contestActivity, contestPayments, entryTimes, invitedCount, judgedEntries, payHref } from "@/lib/client/workspace";
import { addonPrices } from "@/lib/contests/addon-payments";
import { getContestBySlug } from "@/lib/contests/browse";
import { contestRepository } from "@/lib/contests/services";
import { briefEditHref, briefReadyPercent } from "@/lib/onboarding/brief-defaults";
import { answerLines, contestExtraAnswers, getOnboarding } from "@/lib/onboarding/store";
import { onboardingV2On } from "@/lib/onboarding/v2-steps";
import { isFinished } from "@/lib/contests/public-statuses";
import { formatDate } from "@/lib/dates";
import { getEntryDetail } from "@/lib/entries/queries";
import { contestGuarantee } from "@/lib/guarantee/queries";
import { isShareableDesign } from "@/lib/entries/rules";
import { linkOrigin } from "@/lib/site-origin";
import { designPath, designPinPath } from "@/lib/share/links";
import { CHAT_STATUSES } from "@/lib/handover/options";
import { getHandoverByContest, handoverMessages } from "@/lib/handover/queries";
import { getI18n } from "@/lib/i18n/server";
import { entryReport } from "@/lib/logo-check/entry-check";
import { filterCounts, isJudgingSort, matchesFilter, sortForJudging, type JudgingSort } from "@/lib/logo-check/entry-rules";
import { levelRanges } from "@/lib/logo-check/entry-links";
import { contestChecks } from "@/lib/logo-check/queries";
import { checkerReady } from "@/lib/logo-check/start";
import { formatNumber, formatTaka } from "@/lib/money";
import { awaitingApproval } from "@/lib/payments/manual";
import { openMethods } from "@/lib/payments/methods";
import { getService } from "@/lib/services/store";
import { isLogo } from "@/lib/services/types";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("cw.detail.metaTitle"), robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Premium client workspace › Contest details (owner, 2026-10-16; Design/client-premium/client-contest-details.html):
// "Details" from a contest card. Six tabs, deep-linkable with ?tab=. Every tool is the existing one: stars, shortlist,
// reject, pick a winner (design view), logo checks, add-ons (extend time), final files, copy claims.
export default async function ClientContestPage({ params, searchParams }: PageProps<"/client/contests/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?as=client&next=${encodeURIComponent(`/client/contests/${id}`)}`);
  // An old link with the contest's id goes to its address.
  if (UUID.test(id)) {
    const { data } = await createAdminClient().from("contests").select("slug").eq("id", id).maybeSingle();
    if (data?.slug) redirect(`/client/contests/${data.slug}`);
    notFound();
  }
  const [{ t, locale, currency }, contest] = await Promise.all([getI18n(), getContestBySlug(id, user)]);
  if (!contest) notFound();
  // The admin team keeps the client's view in the old page (read-only, with the way back to the admin).
  if (!contest.isOwner) {
    if (hasPermission(user, "contests.view")) redirect(`/dashboard/contests/${contest.slug}`);
    notFound();
  }

  const tab: ContestTab = contestTab(sp.tab);
  const filter = DESIGN_FILTERS.find((f) => f === designFilter(sp.filter)) ?? "all";
  const sort: JudgingSort = isJudgingSort(sp.sort) ? sp.sort : "pro";
  const entryNumber = typeof sp.entry === "string" ? Number(sp.entry) : null;
  const svc = isLogo(contest.service) ? null : await getService(contest.service);
  const ratio = svc && svc.width > 0 && svc.height > 0 ? svc.width / svc.height : 1;
  const checkerOn = contest.service === "logo";
  const unpaid = contest.rawStatus === "draft" || contest.rawStatus === "pending_payment";
  const entryContest = { ownerId: contest.ownerId, isBlind: contest.isBlind, canSeeBrief: true, status: contest.status, winnerIsPublic: contest.winnerIsPublic };

  const [entries, prices, s, entry, handover, checks, payments, invited, times, ranges, waiting, guarantee, record] = await Promise.all([
    unpaid ? Promise.resolve([]) : judgedEntries({ id: contest.id, ownerId: contest.ownerId, isBlind: contest.isBlind, status: contest.status, winnerIsPublic: contest.winnerIsPublic }, user),
    addonPrices(),
    getSettings(["timers.designer_file_upload_days", "limits.contest_comment_max_length", "limits.max_revision_requests", "limits.approval_feedback_max_words", "timers.copy_claim_days", "timers.judging_window_days", "onboarding.approval_minutes"]),
    entryNumber && !unpaid ? getEntryDetail(contest.id, entryNumber, entryContest, user) : null,
    getHandoverByContest(contest.id),
    checkerOn ? contestChecks({ id: contest.id, prize: contest.prize, logoScan: contest.logoScan, status: contest.rawStatus }) : null,
    contestPayments(contest.id),
    invitedCount(contest.id),
    entryTimes(contest.id),
    levelRanges(),
    unpaid ? awaitingApproval([contest.id]) : Promise.resolve(new Map<string, string>()),
    // Money-back guarantee (owner, 2026-10-21; C-25).
    unpaid ? Promise.resolve(null) : contestGuarantee(contest.id),
    // Onboarding v2's brief and mark while the brief can still change (owner, 2026-10-29). The whole row, so a database
    // before migration 0079 simply has no mark (an old contest).
    unpaid || contest.rawStatus === "open" ? contestRepository().findContest(contest.id).catch(() => null) : Promise.resolve(null),
  ]);
  const claimStatus = guarantee?.state.kind === "claimed" ? guarantee.state.status : null;
  // While the team checks a money-back claim, picking a winner is paused; once approved, the money goes back.
  const claimPending = claimStatus === "pending";
  const moneyBack = claimStatus === "approved" || claimStatus === "refunded";
  // A cancelled contest (money back, or cancelled by the team): its designs aren't shown to the client any more.
  const cancelled = contest.rawStatus === "cancelled";
  // A no-result end where nobody got a share and the late claim is still possible or being checked.
  const notShared = contest.rawStatus === "no_result" && ((guarantee?.state.kind === "available" || guarantee?.state.kind === "check") ? guarantee.state.late : claimPending);
  // Until when the client can still pick (only while judging: after a pick or a no-result end there is none).
  const pickUntil = contest.status === "judging" ? contest.judgingEndsAt : null;
  const [claim, messages] = handover ? await Promise.all([latestClaim(handover.id), handoverMessages(handover.id, user.id, handover.clientId)]) : [null, []];
  const reportNumber = typeof sp.report === "string" ? Number(sp.report) : null;
  const reportOf = checkerOn && reportNumber ? (entries.find((e) => e.number === reportNumber) ?? null) : null;
  const report = reportOf ? await entryReport(reportOf, user) : null;

  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
  const day = (d: Date) => formatDate(d, locale, "short");
  const now = new Date();
  const finished = isFinished(contest.rawStatus);
  // Facebook and Pinterest (owner, 2026-10-18): the open design, when a logged-out visitor sees it too.
  const shareOrigin =
    entry &&
    !entry.locked &&
    isShareableDesign({ status: entry.status, isHidden: entry.hidden }, { status: contest.rawStatus, isPrivate: contest.isPrivate, isNda: contest.isNda, isBlind: contest.isBlind, winnerIsPublic: contest.winnerIsPublic })
      ? await linkOrigin()
      : null;
  const reviewing = contest.status === "open" || contest.status === "judging";
  const fileDays = s["timers.designer_file_upload_days"];
  const here = contestHref(contest.slug, tab, tab === "designs" ? { filter, sort: sort !== "pro" ? sort : null } : {});
  const withParam = (href: string, param: string) => `${href}${href.includes("?") ? "&" : "?"}${param}`;
  const counts = filterCounts(entries);
  const shown = sortForJudging(entries.filter((e) => matchesFilter(e, filter)), sort);
  const top = [...entries].filter((e) => e.rating).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.number - a.number).slice(0, 3);
  const designerIds = [...new Set(entries.map((e) => e.designerId))];
  const proCount = designerIds.filter((d) => entries.find((e) => e.designerId === d)?.pro).length;
  const contestPay = payments.find((p) => p.purpose === "contest" && p.status === "paid") ?? null;
  const addonsPaid = payments.filter((p) => p.purpose !== "contest" && p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const won = typeof sp.won === "string" ? (entries.find((e) => e.status === "winner" && e.number === Number(sp.won)) ?? null) : null;
  const claimUntil = handover ? claimWindowEnds(handover.pickedAt, s["timers.copy_claim_days"]) : null;
  const claimable = handover ? canOpenClaim(handover, new Date(), s["timers.copy_claim_days"], claim?.status === "open") : false;
  const left = leftParts(contest.endsAt, now);
  // Onboarding v2's brief mark, read while the brief can still change (owner, 2026-10-29).
  const completion = record?.briefCompletion ?? null;
  // "Edit brief" (owner, 2026-10-30: after Finish there was no way back): a v2 contest opens its brief page while unpaid,
  // waiting for approval or live; an older contest opens Edit details while live.
  const editHref = briefEditHref({ id: contest.id, slug: contest.slug, status: contest.rawStatus, v2: completion !== null, hubOn: onboardingV2On() });
  const canEdit = editHref !== null;
  // Reference photos: on the v2 brief page's own photo card, or in Edit details.
  const photosHref = completion !== null && editHref?.startsWith("/start-v2/") ? `${editHref}#photos` : `/dashboard/contests/${contest.slug}/edit#photos`;
  const canExtend = contest.status === "open";
  // The main button follows what the contest needs now: pay, review, pick a winner or get the files.
  // A bKash payment sent and waiting for an admin (owner, 2026-10-25): nothing left to pay.
  const sent = waiting.has(contest.id);
  // Onboarding v2 (owner, 2026-10-29; spec §3): "Checking" in the progress while its bKash payment waits.
  const checking = sent && completion !== null;
  const stages = contestStages(contest.rawStatus, { waiting: checking });
  const sentPay = checking ? payments.find((p) => p.id === waiting.get(contest.id)) : undefined;
  const headAction = claimPending && mainAction(contest.rawStatus) === "pick" ? "details" : mainAction(contest.rawStatus, sent);
  const headHref =
    headAction === "pay" || headAction === "waiting"
      ? payHref(contest.id, waiting)
      : headAction === "pick"
        ? contestHref(contest.slug, "designs", { sort: "top" })
        : headAction === "files"
          ? `${contestHref(contest.slug, "payment")}#files`
          : moneyBack
            ? `${contestHref(contest.slug, "payment")}#guarantee`
            : contestHref(contest.slug, "designs");
  const designerName = (e: { designer: { name: string; username: string | null } | null }) => (e.designer?.username ? `@${e.designer.username}` : (e.designer?.name ?? t("entry.hiddenName")));

  const checker = {
    contest: { id: contest.id, slug: contest.slug, brand: contest.brandName },
    designs: entries.filter((e) => e.status !== "rejected").map((e) => ({ id: e.id, number: e.number, coverUrl: e.previews[0] ?? null, designer: designerName(e) })),
    state: checks!,
    ready: checkerReady(),
    lens: Boolean(process.env.SEARCHAPI_API_KEY),
  };

  // The designers who sent designs: how many, the last one, and a design to talk about.
  const designers = designerIds
    .map((d) => {
      const mine = entries.filter((e) => e.designerId === d);
      const last = mine.map((e) => times.get(e.id)).filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const chat = mine.find((e) => e.chat) ?? null;
      return { id: d, name: designerName(mine[0]), pro: mine[0].showPro, trial: mine[0].trial, count: mine.length, last, chatEntry: chat?.id ?? null };
    })
    .sort((a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));

  const createdAt = (await createdAtOf(contest.id)) ?? now;
  const activity = contestActivity({
    createdAt,
    startsAt: contest.startsAt,
    endsAt: contest.endsAt,
    status: contest.rawStatus,
    payments,
    invited,
    entries: entries.map((e) => ({ number: e.number, createdAt: times.get(e.id) ?? now, designer: contest.isBlind && !finished ? null : designerName(e) })),
    handover: handover ? { pickedAt: handover.pickedAt, submittedAt: handover.submittedAt, approvedAt: handover.approvedAt, entryNumber: handover.entryNumber, designer: handover.designer.username ? `@${handover.designer.username}` : handover.designer.name } : null,
    completedAt: contest.rawStatus === "completed" ? (handover?.approvedAt ?? null) : null,
    now,
  });

  const tabLabel = (k: ContestTab) => (k === "designs" ? `${t("cw.detail.tabs.designs")} ${num(counts.all)}` : k === "designers" ? `${t("cw.detail.tabs.designers")} ${num(designers.length)}` : t(`cw.detail.tabs.${k}`));

  const designCard = (e: (typeof entries)[number]) => (
    <div key={e.id} className="dte" data-entry={e.number}>
      <div className="cfri" style={e.status === "winner" ? { boxShadow: "0 0 0 2px #D9A52B" } : undefined}>
        <Link href={withParam(here, `entry=${e.number}`)} scroll={false} className="cover" aria-label={t("entry.open", { n: num(e.number) })}>
          <Picture url={e.previews[0] ?? null} name={contest.brandName} />
        </Link>
        {e.showPro && <ProOnPicture />}
        <span className="eno2">#{num(e.number)}</span>
        <ShortlistHeart entryId={e.id} on={e.isShortlisted} disabled={!reviewing || e.status !== "active"} />
      </div>
      <div className="cfrb">
        <b>{designerName(e)}</b>
        {e.showPro ? <ProChip trial={e.trial} t={t} /> : <BasicChip t={t} />}
      </div>
      <div className="dter">
        {checkerOn ? <CheckChip badge={e.badge} t={t} /> : <span />}
        <Stars rating={e.rating} label={e.rating ? t("cw.review.stars", { n: e.rating }) : t("cw.review.notRated")} />
      </div>
      {e.status === "winner" && <span className="pss win">{t("entry.winner")}</span>}
      {e.status === "rejected" && <span className="pss" style={{ background: "#FFE9E7", color: "#B3261E" }}>{t("entry.rejected")}</span>}
      {checkerOn && <CheckCardAction entryId={e.id} reportCheckId={e.badge.kind === "checked" ? e.checkId : null} />}
      {e.chat && <MessageDesignerLink entryId={e.id} label={t("pro.chat.message")} size="sm" />}
    </div>
  );

  return (
    <>
      <CheckerProvider setup={checkerOn && checks ? checker : null} lens={checker.lens}>
        {/* Meta Pixel (owner, 2026-10-24): a bKash payment an admin approved shows here first (same key as the card path). */}
        {contestPay && !unpaid && freshPurchase(contestPay.paidAt) && <PurchasePixel paymentId={contestPay.id} value={contestPay.amount} />}
        {sp.payment === "paid" && <p className="calert ok">{t("manage.payment.paid")}</p>}
        {sp.payment === "failed" && <p className="calert bad">{t("manage.payment.failed")}</p>}
        {/* Onboarding v2's brief banner (owner, 2026-10-29; spec §3): at the top, never a pop-up. */}
        {record && completion && onboardingV2On() && (
          <BriefBanner
            contestId={contest.id}
            slug={contest.slug}
            status={contest.rawStatus}
            completion={completion}
            percent={briefReadyPercent(record.brief)}
            businessType={record.brief.businessType}
            entries={counts.all}
            unrated={counts.unrated}
            waiting={sent}
          />
        )}

        {/* Header */}
        <div className="dth2">
          <span className="dtlg">
            <Picture url={contest.cover?.url ?? null} name={contest.brandName} />
          </span>
          <div>
            <div className="dnl">
              <h1>{contest.brandName}</h1>
              <StatusPill status={contest.rawStatus} waiting={sent} t={t} />
            </div>
            <p>
              {contest.businessType === "other" && contest.brief?.businessTypeOther ? contest.brief.businessTypeOther : t(`wizard.businessTypes.${contest.businessType}`)}
              {contest.number ? ` · LC-${String(contest.number).padStart(4, "0")}` : ""}
              {contest.startsAt ? ` · ${t("cw.my.started", { date: day(contest.startsAt) })}` : ""}
              {contest.endsAt ? ` · ${t("cw.detail.endsOn", { date: day(contest.endsAt) })}` : ""}
            </p>
          </div>
          <div className="dtpr">
            <span>{t("cw.my.prize")}</span>
            <b>{taka(contest.prize)}</b>
          </div>
          {contest.status === "open" && left && (
            <div className="dtcd">
              <span>{t("cw.detail.endsIn")}</span>
              <b>{t(left.unit === "d" ? "cw.time.daysShort" : "cw.time.hoursShort", { n: num(left.n) })}</b>
            </div>
          )}
          {contest.status === "judging" && contest.judgingEndsAt && !claimPending && (
            <div className="dtcd">
              <span>{t("cw.detail.pickBy")}</span>
              <b>{day(contest.judgingEndsAt)}</b>
            </div>
          )}
        </div>

        {/* Tabs and actions */}
        {/* Tabs, then the actions; on phones the tabs are one sliding row and the actions go under it (owner, 2026-10-17). */}
        <div className="dtbar">
          <nav className="dtabs dtt" aria-label={t("cw.detail.tabsLabel")}>
            {CONTEST_TABS.map((k) => (
              <Link key={k} href={contestHref(contest.slug, k)} className={k === tab ? "on" : undefined} aria-current={k === tab ? "page" : undefined} scroll={false} data-tab={k}>
                {tabLabel(k)}
              </Link>
            ))}
          </nav>
          <NavScroll selector=".dtbar .dtt" />
          <span className="dtact">
            {canEdit && (
              <Link href={editHref!} className="dout sm">
                {t("cw.detail.editBrief")}
              </Link>
            )}
            {canExtend && (
              <Link href={`${contestHref(contest.slug, "payment")}#addons`} className="dout sm">
                {t("cw.detail.extend")}
              </Link>
            )}
            <Link href={headHref} className="dbtn sm" data-main-action={headAction}>
              {moneyBack ? t("guarantee.prizeState") : t(`cw.action.${headAction === "details" ? "review" : headAction}`)}
            </Link>
          </span>
        </div>

        {contest.status === "judging" && contest.judgingEndsAt && !claimPending && <p className="calert info">{t("lifecycle.pickBy", { date: formatDate(contest.judgingEndsAt, locale, "long") })}</p>}
        {contest.status === "no_result" && claimStatus !== "pending" && guarantee?.state.kind !== "available" && <p className="calert info">{t("lifecycle.noResultClient")}</p>}
        {guarantee && <GuaranteeBanner contestId={contest.id} g={guarantee} judgingEndsAt={pickUntil} />}

        {/* Overview */}
        {tab === "overview" && (
          <section className="dpn on" data-panel="overview">
            <div className="cg2">
              <div className="dcol">
                <section className="dcard">
                  <div className="dch">
                    <h2>{t("cw.detail.progress")}</h2>
                  </div>
                  <ol className="dtl">
                    {stagesFor(contest.rawStatus, { waiting: checking }).map((st, i) => {
                      const line =
                        st === "brief"
                          ? when(createdAt)
                          : st === "paid"
                            ? contestPay?.paidAt
                              ? `${taka(contestPay.amount)} · ${when(contestPay.paidAt)}`
                              : checking
                                ? `${sentPay ? `${taka(sentPay.amount)} · ` : ""}${t("cw.home.paySent")}`
                                : t("cw.detail.notYet")
                            : st === "checking"
                              ? t("cw.status.awaiting")
                              : st === "live"
                                ? contest.startsAt
                                  ? when(contest.startsAt)
                                  : t("cw.detail.notYet")
                                : st === "judging"
                                  ? contest.endsAt
                                    ? t("cw.detail.endsOn", { date: day(contest.endsAt) })
                                    : t("cw.detail.notYet")
                                  : moneyBack
                                    ? st === "winner"
                                      ? t("guarantee.prizeState")
                                      : "—"
                                    : st === "winner"
                                      ? handover
                                        ? when(handover.pickedAt)
                                        : t("cw.detail.pickWithin", { n: num(s["timers.judging_window_days"]) })
                                      : handover?.approvedAt
                                        ? when(handover.approvedAt)
                                        : t("cw.detail.afterPick");
                      return (
                        <li key={st} className={stages[i]}>
                          <i />
                          <div>
                            <b>{st === "checking" ? t("wizardV2.timeline.checking") : t(`cw.detail.steps.${st}`)}</b>
                            <em>{line}</em>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {checking && (
                    <div className="mt-4 rounded-[14px] bg-[#F4F5F7] px-4 py-3" data-checking>
                      <b className="block text-[14.5px]">{t("wizardV2.banner.checking", { minutes: num(s["onboarding.approval_minutes"]) })}</b>
                      <span className="dmut">{t("wizardV2.banner.tellLive")}</span>
                    </div>
                  )}
                </section>
                <section className="dcard">
                  <div className="dch">
                    <h2>{t("cw.detail.top")}</h2>
                    <span className="dmut">{t("cw.detail.byStars")}</span>
                  </div>
                  {cancelled ? <Empty title={t("guarantee.hiddenDesigns")} /> : top.length === 0 ? <Empty title={t("cw.detail.topNone")} lead={t("cw.detail.topNoneLead")} /> : <div className="dtg">{top.map(designCard)}</div>}
                </section>
              </div>
              <div className="dcol">
                <section className="dcard">
                  <div className="dch">
                    <h2>{t("cw.detail.glance")}</h2>
                  </div>
                  <div className="dgl">
                    <div>
                      <span>{t("cw.detail.tabs.designs")}</span>
                      <b>{num(counts.all)}</b>
                    </div>
                    <div>
                      <span>{t("cw.detail.tabs.designers")}</span>
                      <b>{t("cw.detail.designersPro", { n: num(designers.length), pro: num(proCount) })}</b>
                    </div>
                    {checkerOn && (
                      <div>
                        <span>{t("cw.detail.checked")}</span>
                        <b>{t("cw.detail.xOfY", { x: num(counts.checked), y: num(counts.all) })}</b>
                      </div>
                    )}
                    <div>
                      <span>{t("cw.detail.rated")}</span>
                      <b>{t("cw.detail.xOfY", { x: num(entries.filter((e) => e.rating).length), y: num(counts.all) })}</b>
                    </div>
                    <div>
                      <span>{t("cw.detail.shortlisted")}</span>
                      <b>{num(counts.shortlisted)}</b>
                    </div>
                    <div>
                      <span>{t("cw.detail.invited")}</span>
                      <b>{num(invited.n)}</b>
                    </div>
                  </div>
                </section>
                <section className="dcard">
                  <div className="dch">
                    <h2>{t("cw.detail.briefSummary")}</h2>
                    <span className="flex items-center gap-3">
                      {canEdit && (
                        <Link href={editHref!} className="dlink sm">
                          {t("cw.detail.editBrief")}
                        </Link>
                      )}
                      <Link href={contestHref(contest.slug, "brief")} className="dlink sm">
                        {t("cw.home.open")}
                      </Link>
                    </span>
                  </div>
                  {/* No description yet (onboarding v2 asks for it after paying): the slogan or customers instead. */}
                  <p className="dbs">{contest.brief?.description?.trim() || contest.brief?.slogan || contest.brief?.targetAudience || "—"}</p>
                  {contest.brief && (contest.brief.styles.length > 0 || contest.brief.colors.length > 0) && (
                    <div className="efl">
                      {contest.brief.styles.map((x) => (
                        <span key={x}>{t(`wizard.styles.${x}` as Parameters<typeof t>[0])}</span>
                      ))}
                      {contest.brief.colors.slice(0, 4).map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </div>
                  )}
                </section>
                <section className="dcard">
                  <div className="dch">
                    <h2>{t("cw.detail.payment")}</h2>
                    <span className={`pss ${contestPay ? "op" : "win"}`}>{t(contestPay ? "cw.detail.paid" : "cw.detail.notPaid")}</span>
                  </div>
                  <div className="cdl">
                    <div>
                      <span>{t("cw.detail.prizeHeld")}</span>
                      <b>{moneyBack ? t("guarantee.prizeState") : taka(contest.prize)}</b>
                    </div>
                    <div>
                      <span>{t("cw.detail.addons")}</span>
                      <b>{taka(addonsPaid)}</b>
                    </div>
                    <div>
                      <span>{t("cw.detail.paidOn")}</span>
                      <b>{contestPay?.paidAt ? day(contestPay.paidAt) : "—"}</b>
                    </div>
                    <div>
                      <span>{t("cw.detail.txn")}</span>
                      <b>{contestPay?.txnId ?? "—"}</b>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </section>
        )}

        {/* Designs */}
        {tab === "designs" && (
          <section className="dpn on" data-panel="designs">
            <div className="efl dfl">
              {DESIGN_FILTERS.map((f) => (
                <Link key={f} href={contestHref(contest.slug, "designs", { filter: f, sort: sort !== "pro" ? sort : null })} className={f === filter ? "on" : undefined} scroll={false} data-filter={f}>
                  {t(`cw.detail.filters.${f}`)} {num(counts[f])}
                </Link>
              ))}
              <Link href={contestHref(contest.slug, "designs", { filter, sort: null })} className={sort === "pro" ? "on" : undefined} scroll={false} data-sort="pro">
                {t("cw.detail.proFirst")}
              </Link>
              <Link href={contestHref(contest.slug, "designs", { filter, sort: "top" })} className={sort === "top" ? "on" : undefined} scroll={false} data-sort="top">
                {t("cw.detail.topRated")}
              </Link>
              <Link href={contestHref(contest.slug, "designs", { filter, sort: "newest" })} className={sort === "newest" ? "on" : undefined} scroll={false} data-sort="newest">
                {t("cw.detail.newest")}
              </Link>
            </div>
            {shown.length === 0 ? <Empty title={unpaid ? t(sent ? "cw.detail.waitingDesigns" : "cw.detail.unpaidDesigns") : cancelled ? t("guarantee.hiddenDesigns") : t("manage.review.empty")} /> : <div className="dtg six">{shown.map(designCard)}</div>}
            {checkerOn && counts.all > 0 && <CheckLegend ranges={ranges} t={t} />}
            {checkerOn && !unpaid && (
              <div className="lc-tools" style={{ marginTop: 20 }}>
                {report && <ReportPanel report={report} closeHref={here} t={t} locale={locale} />}
                <CheckerBox />
              </div>
            )}
          </section>
        )}

        {/* Brief */}
        {tab === "brief" && (
          <section className="dpn on" data-panel="brief">
            <section className="dcard">
              <div className="dch">
                <h2>{t("cw.detail.tabs.brief")}</h2>
                <span className="flex flex-wrap items-center gap-2">
                  {/* A live v2 contest: its brief page doesn't have the logo name, logo text, short name or type; those are
                      in Edit details (owner, 2026-10-30). */}
                  {completion !== null && contest.rawStatus === "open" && editHref?.startsWith("/start-v2/") && (
                    <Link href={`/dashboard/contests/${contest.slug}/edit`} className="dlink sm">
                      {t("cw.detail.moreDetails")}
                    </Link>
                  )}
                  {canEdit && (
                    <Link href={editHref!} className="dout sm">
                      {t("cw.detail.editBrief")}
                    </Link>
                  )}
                </span>
              </div>
              {/* No reference photos yet, and the contest is live: they can still be added (owner, 2026-10-22). */}
              {canEdit && contest.brief && contest.brief.files.length === 0 && (svc || !(await getOnboarding("client")).hidden.includes("files")) && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-[#F4F5F7] px-4 py-3">
                  <span className="dmut">{t("manage.edit.photos.none")}</span>
                  <Link href={photosHref} className="dout sm">
                    {t("manage.edit.photos.add")}
                  </Link>
                </div>
              )}
              {/* A non-logo contest shows its own questions and reference images (owner, 2026-10-17). */}
              {contest.brief && svc ? (
                <ServiceBrief service={svc} answers={contest.serviceBrief} full files={contest.brief.files} hidden={contest.hiddenPrivate} />
              ) : contest.brief ? (
                <ContestBrief brief={contest.brief} withDescription extra={answerLines(await getOnboarding("client"), await contestExtraAnswers(contest.id), locale)} />
              ) : (
                <Empty title={t("cw.detail.noBrief")} />
              )}
            </section>
          </section>
        )}

        {/* Designers */}
        {tab === "designers" && (
          <section className="dpn on" data-panel="designers">
            <section className="dcard">
              {designers.length === 0 ? (
                cancelled ? <Empty title={t("guarantee.hiddenDesigns")} /> : <Empty title={t("cw.detail.noDesigners")} lead={t("cw.detail.noDesignersLead")} />
              ) : (
                designers.map((d) => (
                  <div key={d.id} className="cdt">
                    <span className="psav sm">
                      <span className="dring" />
                      <ClientAvatar name={d.name.replace(/^@/, "")} url={null} />
                    </span>
                    <div>
                      <b>
                        {d.name} {d.pro && <ProChip trial={d.trial} t={t} />}
                      </b>
                      <em>{t("cw.detail.designerLine", { n: num(d.count), date: d.last ? day(d.last) : "—" })}</em>
                    </div>
                    {d.chatEntry ? (
                      <Link href={`/client/messages?entry=${d.chatEntry}`} className="dout sm">
                        {t("cw.detail.message")}
                      </Link>
                    ) : (
                      <Link href={withParam(contestHref(contest.slug, "designs"), `entry=${entries.find((e) => e.designerId === d.id)?.number ?? ""}`)} className="dout sm">
                        {t("cw.detail.seeDesigns")}
                      </Link>
                    )}
                  </div>
                ))
              )}
            </section>
          </section>
        )}

        {/* Payment & files */}
        {tab === "payment" && (
          <section className="dpn on" data-panel="payment">
            <div className="cg2">
              <section className="dcard">
                <div className="dch">
                  <h2>{t("cw.detail.payment")}</h2>
                </div>
                <div className="cdl">
                  <div>
                    <span>{t("cw.detail.prize")}</span>
                    <b>{taka(contest.prize)}</b>
                  </div>
                  <div>
                    <span>{t("cw.detail.paidWith")}</span>
                    <b>{contestPay ? t(`cw.methods.${contestPay.method === "card" ? "card" : "bkash"}`) : "—"}</b>
                  </div>
                  <div>
                    <span>{t("cw.detail.paidOn")}</span>
                    <b>{contestPay?.paidAt ? day(contestPay.paidAt) : "—"}</b>
                  </div>
                  <div>
                    <span>{t("cw.detail.txn")}</span>
                    <b>{contestPay?.txnId ?? "—"}</b>
                  </div>
                  <div>
                    <span>{t("cw.detail.status")}</span>
                    <b>{moneyBack ? t("guarantee.prizeState") : notShared ? t("guarantee.notShared") : t(`cw.detail.prizeState.${!contestPay ? (sent ? "waiting" : "unpaid") : handover?.status === "approved" || contest.rawStatus === "completed" ? "released" : contest.rawStatus === "no_result" ? "shared" : "held"}`)}</b>
                  </div>
                </div>
                {payments.filter((p) => p.purpose !== "contest" && p.status === "paid").length > 0 && (
                  <div className="cdl" style={{ marginTop: 12 }}>
                    {payments
                      .filter((p) => p.purpose !== "contest" && p.status === "paid")
                      .map((p) => (
                        <div key={p.id}>
                          <span>{p.purpose === "extension" ? t("cw.detail.extension", { n: num(p.extensionDays ?? 0) }) : t("cw.detail.addon")}</span>
                          <b>
                            {taka(p.amount)} · {p.paidAt ? day(p.paidAt) : ""}
                          </b>
                        </div>
                      ))}
                  </div>
                )}
                {unpaid && (
                  <Link href={payHref(contest.id, waiting)} className="dbtn sm" style={{ marginTop: 14 }}>
                    {t(sent ? "cw.action.waiting" : "cw.action.pay")}
                  </Link>
                )}
              </section>
              <section className="dcard" id="files">
                <div className="dch">
                  <h2>{t("cw.detail.finalFiles")}</h2>
                  {handover && (
                    <span className="dmut">
                      #{num(handover.entryNumber)} · {handover.designer.username ? `@${handover.designer.username}` : handover.designer.name}
                    </span>
                  )}
                </div>
                {handover ? (
                  <>
                    <HandoverTracker status={handover.status} t={t} />
                    <div style={{ marginTop: 16 }}>
                      <ClientHandover
                        handoverId={handover.id}
                        status={handover.status}
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
                    {handover.status !== "no_result" && (CHAT_STATUSES.includes(handover.status) || messages.length > 0) && (
                      <div style={{ marginTop: 16, borderTop: "1px solid var(--ln)", paddingTop: 14 }}>
                        <HandoverChat handoverId={handover.id} viewer="client" open={CHAT_STATUSES.includes(handover.status)} messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))} />
                      </div>
                    )}
                    {claimUntil && (claimable || claim) && (
                      <div style={{ marginTop: 16, borderTop: "1px solid var(--ln)", paddingTop: 14 }}>
                        <CopyClaim handoverId={handover.id} canClaim={claimable} until={claimUntil.toISOString()} claim={claim ? { status: claim.status, outcome: claim.outcome, adminNote: claim.adminNote } : null} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="dlock">
                    <CwIcon name="lock" size={26} />
                    <b>{t("cw.detail.filesLocked")}</b>
                    <em>{cancelled ? t("guarantee.hiddenDesigns") : t("cw.detail.filesWhat")}</em>
                  </div>
                )}
              </section>
            </div>
            {guarantee && <GuaranteeCard contestId={contest.id} g={guarantee} judgingEndsAt={pickUntil} />}
            {!unpaid && (
              <section className="dcard" id="addons" style={{ marginTop: 24, scrollMarginTop: 24 }}>
                <div className="dch">
                  <h2>{t("dashboard.addons")}</h2>
                  <span className="dmut">{t("manage.addons.subtitle")}</span>
                </div>
                <AddonsPanel
                  contestId={contest.id}
                  open={contest.status === "open"}
                  active={{ promote: contest.isPromoted, private: contest.isPrivate, blind: contest.isBlind, logo_scan: contest.logoScan }}
                  prices={prices}
                  extensionDays={prices.extensionDays}
                  endsAt={contest.endsAt ? contest.endsAt.toISOString() : null}
                  locale={locale}
                  prize={contest.prize}
                  methods={await openMethods(locale, currency.code)}
                />
              </section>
            )}
          </section>
        )}

        {/* Activity */}
        {tab === "activity" && (
          <section className="dpn on" data-panel="activity">
            <section className="dcard">
              {activity.map((a, i) => (
                <div key={i} className="aplg2">
                  <i />
                  <div>
                    <b>{t(`cw.activity.${a.kind}`, { n: a.n !== undefined ? num(a.n) : "", who: a.who ?? t("entry.hiddenName"), amount: a.amount !== undefined ? taka(a.amount) : "" })}</b>
                    <em>{when(a.at)}</em>
                  </div>
                </div>
              ))}
            </section>
          </section>
        )}

        {/* One design with the owner tools (C-15) */}
        {entry && (
          <EntryViewer
            square={ratio === 1}
            number={entry.number}
            images={entry.previews}
            labels={entry.labels}
            winner={entry.status === "winner"}
            closeHref={here}
            byline={entry.designer ? t("entry.by", { name: entry.designer.username ? `@${entry.designer.username}` : entry.designer.name }) : t("entry.hiddenName")}
          >
            <div className="space-y-5">
              {entries.find((e) => e.id === entry.id)?.chat && <MessageDesignerLink entryId={entry.id} label={t("pro.chat.message")} />}
              <OwnerActions entryId={entry.id} number={entry.number} rating={entry.rating} shortlisted={entry.isShortlisted} canAct={reviewing && entry.status === "active" && !claimPending} readOnly={finished} fileDays={fileDays} variant="panel" wonHref={withParam(here, `won=${entry.number}`)} />
              <VoteButtons entryId={entry.id} up={entry.upVotes} down={entry.downVotes} mine={entry.myVote} canVote={!finished} hint={finished ? t("contest.finished") : null} />
              {/* Share this design (owner, 2026-10-18): ask friends on Facebook, only when visitors can see it too. */}
              {shareOrigin && (
                <div data-entry-share>
                  <p className="m-0 mb-2 text-sm font-semibold text-ink">{t("share.design")}</p>
                  <ShareButtons
                    url={`${shareOrigin}${designPath(contest.slug, entry.number)}`}
                    media={`${shareOrigin}${designPinPath(contest.slug, entry.number)}`}
                    text={t(entry.status === "winner" ? "share.winnerText" : "share.designText", { n: num(entry.number), brand: contest.brandName })}
                  />
                </div>
              )}
              <EntryComments entryId={entry.id} comments={entry.comments} canComment={!finished} reason={finished ? "finished" : "notAllowed"} loginHref="/login" maxLength={s["limits.contest_comment_max_length"]} />
            </div>
          </EntryViewer>
        )}

        {/* "You picked a winner" (C-16) */}
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
    </>
  );
}

/** When the brief was written (the contest row's creation). */
async function createdAtOf(contestId: string): Promise<Date | null> {
  const { data } = await createAdminClient().from("contests").select("created_at").eq("id", contestId).maybeSingle();
  return data?.created_at ? new Date(data.created_at as string) : null;
}

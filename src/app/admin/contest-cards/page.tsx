/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { CardDetail, CardSettings, type CardView } from "@/components/admin/contest-cards-bits";
import { AdminHead } from "@/components/admin/page-head";
import { AdmCard, CardTitle, IdChip, KpiGrid, KpiTile, Pill } from "@/components/admin/ui";
import { Alert } from "@/components/ui/alert";
import { requirePermission } from "@/lib/admin/core";
import { facebookConfigured } from "@/lib/cards/facebook";
import { banglaLine, CARD_SIZES, cardEligibility, MAIN_SIZE, MAX_ATTEMPTS, type CardSizeKey } from "@/lib/cards/rules";
import { cardsReady, cardStats, imageUrl, listCards, type CardListItem } from "@/lib/cards/store";
import { cx } from "@/lib/cx";
import { formatDate, timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.cards.title"), robots: { index: false } };
}

const TABS = ["all", "waiting", "posted", "failed"] as const;
type Tab = (typeof TABS)[number];

/** The card's status in the list and on the detail (Waiting your OK, Scheduled, Posted, Failed, Not posted · why). */
function statusOf(c: CardListItem, t: Translate, locale: "en" | "bn"): { label: string; tone: "warn" | "brand" | "good" | "bad" | "neutral" } {
  switch (c.status) {
    case "waiting":
      return { label: t("admin.cards.status.waiting"), tone: "warn" };
    case "scheduled":
      return { label: t("admin.cards.status.scheduled", { when: c.scheduled_at ? formatDate(new Date(c.scheduled_at), locale, "short") : "" }), tone: "brand" };
    case "posted":
      return { label: t("admin.cards.status.posted"), tone: "good" };
    case "failed":
      return c.attempts > 0 && c.attempts < MAX_ATTEMPTS ? { label: t("admin.cards.status.retrying", { n: formatNumber(c.attempts, locale) }), tone: "bad" } : { label: t("admin.cards.status.failed"), tone: "bad" };
    default: {
      const why = (["private", "client_off", "admin", "not_live"] as const).find((w) => w === c.skip_reason) ?? "admin";
      return { label: t(`admin.cards.status.skipped.${why}`), tone: "neutral" };
    }
  }
}

/**
 * Admin › Auto share › Contest cards (owner, 2026-10-19; Design/contest-cards/admin-contest-cards.html): the cards made
 * for new live contests, their Facebook posts, and the card settings. Same admin roles as Admin › Pinterest.
 */
export default async function AdminContestCardsPage({ searchParams }: PageProps<"/admin/contest-cards">) {
  await requirePermission("autoshare.view");
  const sp = await searchParams;
  const tab: Tab = TABS.find((x) => x === sp.tab) ?? "all";
  const [{ t, locale }, ready, s] = await Promise.all([
    getI18n(),
    cardsReady(),
    getSettings(["cards.auto_post", "cards.check_first", "cards.last24", "cards.post_when", "cards.custom_time", "cards.style", "cards.big_prize_from", "cards.caption", "cards.hashtags"]),
  ]);
  const now = new Date();
  const num = (n: number) => formatNumber(n, locale);
  const [stats, all] = ready.table ? await Promise.all([cardStats(), listCards(80)]) : [null, [] as CardListItem[]];
  const counts: Record<Tab, number> = { all: all.length, waiting: all.filter((c) => c.status === "waiting").length, posted: all.filter((c) => c.status === "posted").length, failed: all.filter((c) => c.status === "failed").length };
  const list = tab === "all" ? all : all.filter((c) => c.status === tab);
  const picked = all.find((c) => c.id === sp.card) ?? list[0] ?? null;
  const fbReady = facebookConfigured();
  const permission = all.find((c) => c.status === "failed" && c.error?.startsWith("PERMISSION"));
  const href = (q: Record<string, string>) => `/admin/contest-cards?${new URLSearchParams({ ...(tab !== "all" ? { tab } : {}), ...q }).toString()}`;

  const view = (c: CardListItem): CardView => {
    const images = Object.fromEntries(CARD_SIZES.map((x) => [x.key, imageUrl(c.images, x.key)]).filter(([, u]) => u)) as Partial<Record<CardSizeKey, string>>;
    const elig = cardEligibility({ status: c.contest.status, isPrivate: false, isNda: false, shareOnFacebook: true, endsAt: c.contest.endsAt ? new Date(c.contest.endsAt) : null }, now);
    return {
      id: c.id,
      style: c.style,
      status: c.status,
      attempts: c.attempts,
      lineBn: c.line_bn ?? banglaLine(c.contest.number),
      caption: c.caption ?? "",
      images,
      fbPostUrl: c.fb_post_url,
      canPost: elig === "ok" && Boolean(images[MAIN_SIZE]),
      skipped: c.status === "skipped",
    };
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <AdminHead title={t("admin.cards.title")} lead={t("admin.cards.lead")} crumbs={[{ href: "/admin/pinterest", label: t("admin.nav.pinterest") }]} />

      {!ready.table && <Alert tone="warning">{t("admin.cards.notReady")}</Alert>}
      {ready.table && !fbReady && <Alert tone="warning">{t("admin.cards.fb.notSet")}</Alert>}
      {fbReady && permission && <Alert tone="danger">{t("admin.cards.fb.permission", { message: (permission.error ?? "").replace(/^PERMISSION /, "") })}</Alert>}

      {stats && (
        <KpiGrid>
          <KpiTile accent label={t("admin.cards.kpi.made")} value={num(stats.made)} hint={stats.since ? t("admin.cards.kpi.since", { date: formatDate(new Date(stats.since), locale, "short") }) : t("admin.cards.kpi.sinceNone")} icon="cards" />
          <KpiTile label={t("admin.cards.kpi.posted")} value={num(stats.posted)} hint={t("admin.cards.kpi.byHand", { n: num(stats.byHand) })} icon="share" />
          <KpiTile label={t("admin.cards.kpi.waiting")} value={num(stats.waiting)} hint={stats.oldestWaiting ? t("admin.cards.kpi.oldest", { ago: timeAgo(new Date(stats.oldestWaiting), now, locale) }) : t("admin.cards.kpi.nothing")} href={href({ tab: "waiting" })} />
          <KpiTile label={t("admin.cards.kpi.failed")} value={num(stats.failed)} hint={t("admin.cards.kpi.failedHint")} href={href({ tab: "failed" })} />
        </KpiGrid>
      )}

      {ready.table && (
        <div className="grid min-w-0 gap-5 min-[1100px]:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* New cards */}
          <AdmCard className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
            <CardTitle title={t("admin.cards.list.title")} />
            <nav aria-label={t("admin.cards.list.title")} className="flex flex-wrap gap-1.5">
              {TABS.map((x) => (
                <Link key={x} href={`/admin/contest-cards${x === "all" ? "" : `?tab=${x}`}`} aria-current={tab === x ? "page" : undefined} className={cx("inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 text-[14.5px] font-bold", tab === x ? "bg-[#111216] text-white" : "bg-[#F4F5F7] text-ink hover:bg-[#ECEDF0]")}>
                  {t(`admin.cards.list.tabs.${x}`)}
                  <span className={cx("text-[13px]", tab === x ? "text-white/70" : "text-muted")}>{num(counts[x])}</span>
                </Link>
              ))}
            </nav>
            {list.length === 0 ? (
              <p className="m-0 rounded-[12px] border border-dashed border-line px-4 py-8 text-center text-[14.5px] text-muted">{t("admin.cards.list.empty")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0" data-card-list>
                {list.map((c) => {
                  const st = statusOf(c, t, locale);
                  const thumb = imageUrl(c.images, MAIN_SIZE);
                  const on = picked?.id === c.id;
                  return (
                    <li key={c.id}>
                      <Link href={href({ card: c.id })} aria-current={on ? "true" : undefined} className={cx("flex items-center gap-3 rounded-[14px] border p-2.5 transition-colors", on ? "border-primary/40 bg-[#FDF6F5] shadow-[inset_3px_0_0_#8B0000]" : "border-[#E9EAEE] bg-white hover:border-[#d6d8de]")}>
                        <span className="flex h-[80px] w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#F4F5F7]">{thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="text-[12px] text-muted">—</span>}</span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <strong className="truncate text-[15.5px] text-ink">{c.contest.brand}</strong>
                            <IdChip prefix="LC" n={c.contest.number} />
                          </span>
                          <span className="text-[13.5px] text-muted">
                            {timeAgo(new Date(c.created_at), now, locale)} · {t("admin.cards.list.prize", { prize: formatTaka(c.contest.prize, locale) })}
                            {c.kind === "last24" ? ` · ${t("admin.cards.detail.lastDay")}` : ""}
                          </span>
                          <Pill tone={st.tone} className="self-start">
                            {st.label}
                          </Pill>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdmCard>

          {/* The picked card */}
          <AdmCard className="flex min-w-0 flex-col gap-4 p-4 sm:p-5" data-card-detail>
            {picked ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em] text-ink">{picked.contest.brand}</h2>
                      <IdChip prefix="LC" n={picked.contest.number} />
                    </div>
                    <span className="text-[14px] text-muted">
                      {t("admin.cards.detail.made", { date: formatDate(new Date(picked.created_at), locale, "short"), live: picked.contest.startsAt ? formatDate(new Date(picked.contest.startsAt), locale, "short") : "—" })}
                    </span>
                    {picked.error && picked.status !== "posted" && <span className="text-[14px] font-semibold text-danger">{t("admin.cards.detail.problem", { message: picked.error.replace(/^PERMISSION /, "") })}</span>}
                  </div>
                  <Pill tone={statusOf(picked, t, locale).tone}>{statusOf(picked, t, locale).label}</Pill>
                </div>
                <CardDetail key={`${picked.id}:${picked.updated_at}`} card={view(picked)} fbReady={fbReady} />
              </>
            ) : (
              <p className="m-0 text-[15px] text-muted">{t("admin.cards.detail.pick")}</p>
            )}
          </AdmCard>
        </div>
      )}

      {/* Settings */}
      <AdmCard className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
        <CardTitle title={t("admin.cards.settings.title")} sub={t("admin.cards.settings.lead")} />
        <CardSettings
          value={{ auto_post: s["cards.auto_post"], check_first: s["cards.check_first"], last24: s["cards.last24"], post_when: s["cards.post_when"], custom_time: s["cards.custom_time"], style: s["cards.style"], big_prize_from: s["cards.big_prize_from"] }}
          caption={s["cards.caption"]}
          hashtags={s["cards.hashtags"]}
          money={formatTaka(s["cards.big_prize_from"], locale)}
        />
      </AdmCard>

      <p className="m-0 text-center text-[14px] text-muted">{t("admin.cards.foot")}</p>
    </div>
  );
}

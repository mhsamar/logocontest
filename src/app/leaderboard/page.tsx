import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle, SectionHead } from "@/components/ui/section-heading";
import { DesignTile } from "@/components/rewards/design-tile";
import { getCurrentUser } from "@/lib/auth/session";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { monthLabel } from "@/lib/notifications/render";
import { pastWinners, thisMonth, winningDesigns } from "@/lib/rewards/queries";
import { canLike } from "@/lib/rewards/rules";
import { openGraphFor } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const title = t("leaderboard.metaTitle");
  return { title, description: t("leaderboard.metaDescription"), alternates: { canonical: "/leaderboard" }, openGraph: openGraphFor({ title, description: t("leaderboard.metaDescription"), path: "/leaderboard", locale }) };
}

// Leaderboard (owner, 2026-10-09): winning designs ranked by likes; this month and all time; past Monthly Winners.
export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const sp = await searchParams;
  const tab = sp.tab === "all" ? "all" : "month";
  const month = thisMonth();
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const [designs, winners] = await Promise.all([winningDesigns({ month: tab === "month" ? month : null, viewerId: user?.id ?? null, limit: 48 }), pastWinners(12)]);

  return (
    <PageShell>
      <Panel as="header">
        <PageTitle center pill={t("leaderboard.eyebrow")} lead={t("leaderboard.title")} sub={t("leaderboard.lead")} />
      </Panel>

      <Panel tone="grey">
      <div className="mx-auto flex w-full max-w-sm rounded-[18px] bg-surface p-1 ring-1 ring-line">
        {(["month", "all"] as const).map((x) => (
          <Link
            key={x}
            href={x === "month" ? "/leaderboard" : "/leaderboard?tab=all"}
            aria-current={tab === x ? "page" : undefined}
            className={cx("inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-[14px] px-3 text-[15px] font-semibold transition-colors", tab === x ? "bg-ink text-white" : "text-ink hover:bg-chip")}
          >
            {x === "month" ? monthLabel(month, locale) : t("leaderboard.allTime")}
          </Link>
        ))}
      </div>
      {user?.role === "designer" ? (
        <p className="mt-3 text-center text-sm text-muted">{t("leaderboard.likeHint")}</p>
      ) : (
        <p className="mt-3 text-center text-sm text-muted">{t("leaderboard.likeDesignersOnly")}</p>
      )}

      {designs.length === 0 ? (
        <div className="mx-auto mt-8 max-w-md">
          <EmptyState title={t(tab === "month" ? "leaderboard.emptyMonth" : "leaderboard.emptyAll")} />
        </div>
      ) : (
        <ol className="m-0 mt-8 grid list-none grid-cols-2 gap-3.5 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {designs.map((d, i) => (
            <li key={d.entryId} className="lc-rv">
              <DesignTile d={d} t={t} rank={i} canLike={canLike(user, d.designerId)} />
            </li>
          ))}
        </ol>
      )}

      </Panel>

      <Panel>
        <SectionHead lead={t("leaderboard.champions")} accent="" sub={t("leaderboard.championsLead")} />
        {winners.length === 0 ? (
          <p className="m-0 mt-6 text-center text-muted">{t("leaderboard.noChampions")}</p>
        ) : (
          <ul className="m-0 mt-8 grid list-none grid-cols-2 gap-3.5 p-0 sm:grid-cols-3 lg:grid-cols-6">
            {winners.map((w) => (
              <li key={w.month} className="lc-rv">
                <p className="mb-2 text-center"><span className="rounded-full bg-gold px-2.5 py-1 text-[13px] font-bold text-gold-ink">{monthLabel(w.month, locale)}</span></p>
                <DesignTile d={w.design} t={t} canLike={canLike(user, w.design.designerId)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageShell>
  );
}

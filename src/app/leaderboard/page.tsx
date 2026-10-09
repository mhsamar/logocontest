import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-6 sm:pt-10">
      <header className="animate-rise text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{t("leaderboard.eyebrow")}</p>
        <h1 className="mt-2 text-h1 font-bold tracking-tight text-ink lg:text-h1-lg">{t("leaderboard.title")}</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted">{t("leaderboard.lead")}</p>
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-sm rounded-full bg-surface p-1 ring-1 ring-line">
        {(["month", "all"] as const).map((x) => (
          <Link
            key={x}
            href={x === "month" ? "/leaderboard" : "/leaderboard?tab=all"}
            aria-current={tab === x ? "page" : undefined}
            className={cx("inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors", tab === x ? "bg-ink text-white" : "text-ink hover:bg-canvas")}
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
        <p className="mx-auto mt-8 max-w-md rounded-3xl border border-dashed border-line bg-surface px-4 py-12 text-center text-muted">{t(tab === "month" ? "leaderboard.emptyMonth" : "leaderboard.emptyAll")}</p>
      ) : (
        <ol className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {designs.map((d, i) => (
            <li key={d.entryId} className="reveal" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <DesignTile d={d} t={t} rank={i} canLike={canLike(user, d.designerId)} />
            </li>
          ))}
        </ol>
      )}

      <section className="mt-14">
        <h2 className="text-center text-h3 font-bold text-ink lg:text-h3-lg">{t("leaderboard.champions")}</h2>
        <p className="mx-auto mt-1 max-w-lg text-center text-sm text-muted">{t("leaderboard.championsLead")}</p>
        {winners.length === 0 ? (
          <p className="mt-4 text-center text-sm text-muted">{t("leaderboard.noChampions")}</p>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {winners.map((w) => (
              <li key={w.month}>
                <p className="mb-1.5 text-center text-xs font-semibold uppercase tracking-wide text-[#8a5105]">{monthLabel(w.month, locale)}</p>
                <DesignTile d={w.design} t={t} canLike={canLike(user, w.design.designerId)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

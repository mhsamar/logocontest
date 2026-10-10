import type { ContestRow } from "@/lib/contests/browse";
import { getI18n } from "@/lib/i18n/server";
import { ContestTile } from "./contest-tile";
import { ButtonLink } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-heading";

/** "Contests live right now" (design file), from the open contests; an empty state until there are any. */
export async function LiveContests({ contests }: { contests: ContestRow[] }) {
  const { t, locale } = await getI18n();
  const now = new Date();
  return (
    <section id="contests" className="rounded-[32px] bg-[var(--lc-panel-alt)] px-6 py-20">
      <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-11">
        <SectionHead
          icon={
            <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M6 6a8.5 8.5 0 0 0 0 12M18 6a8.5 8.5 0 0 1 0 12" />
            </svg>
          }
          lead={t("home.showcase.liveLead")}
          accent={t("home.showcase.liveAccent")}
          sub={t("home.showcase.subtitle")}
        />
        {contests.length ? (
          <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3.5">
            {contests.map((c) => (
              <ContestTile key={c.id} c={c} now={now} t={t} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="lc-card lc-rv flex w-full max-w-xl flex-col items-center gap-2 px-6 py-10 text-center">
            <h3 className="m-0 text-2xl font-semibold tracking-[-0.03em]">{t("home.showcase.emptyTitle")}</h3>
            <p className="m-0 text-[var(--lc-muted)]">{t("home.showcase.emptyBody")}</p>
          </div>
        )}
        <ButtonLink href={contests.length ? "/contests" : "/start"} size="lg">
          {contests.length ? t("home.showcase.browse") : t("home.ways.contest.cta")}
        </ButtonLink>
      </div>
    </section>
  );
}

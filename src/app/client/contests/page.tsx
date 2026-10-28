import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { redirect } from "next/navigation";
import { CwIcon } from "@/components/client/icons";
import { Empty, Picture, StatusPill } from "@/components/client/parts";
import { SortSelect } from "@/components/client/sort-select";
import { getCurrentUser } from "@/lib/auth/session";
import { actionRank, contestHref, contestStages, leftParts, mainAction, MY_SORTS, MY_TABS, mySort, myTab, myTabOf, STAGES } from "@/lib/client/rules";
import { clientContests, payHref } from "@/lib/client/workspace";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { claimStatuses } from "@/lib/guarantee/queries";
import { awaitingApproval } from "@/lib/payments/manual";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("cw.my.metaTitle"), robots: { index: false } };
}

// Premium client workspace › My contests (owner, 2026-10-16; Design/client-premium/client-my-contests.html): "See all"
// from the dashboard. Tabs with counts, search, sort (default: needs my action), one card per contest.
export default async function ClientContestsPage({ searchParams }: PageProps<"/client/contests">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=client&next=%2Fclient%2Fcontests");
  if (user.role !== "client") redirect("/dashboard");
  const sp = await searchParams;
  const tab = myTab(sp.tab);
  const sort = mySort(sp.sort);
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const [{ t, locale }, { contests }] = await Promise.all([getI18n(), clientContests(user.id)]);
  const unpaid = contests.filter((c) => c.status === "draft" || c.status === "pending_payment");
  const waiting = unpaid.length ? await awaitingApproval(unpaid.map((c) => c.id)) : new Map<string, string>();
  // Money-back claims being checked (owner, 2026-10-21): picking is paused on those contests.
  const claims = await claimStatuses(contests.filter((c) => c.status === "judging").map((c) => c.id));
  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const now = new Date();

  const counts = Object.fromEntries(MY_TABS.map((k) => [k, k === "all" ? contests.length : contests.filter((c) => myTabOf(c.status) === k).length])) as Record<(typeof MY_TABS)[number], number>;
  const needle = q.toLowerCase().replace(/^lc-?0*/, "");
  const list = contests
    .filter((c) => tab === "all" || myTabOf(c.status) === tab)
    .filter((c) => !needle || c.brandName.toLowerCase().includes(needle) || (c.number !== null && String(c.number) === needle))
    .sort((a, b) =>
      sort === "newest"
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : sort === "prize"
          ? b.prize - a.prize
          : sort === "designs"
            ? b.entries - a.entries
            : actionRank(a) - actionRank(b) || b.createdAt.getTime() - a.createdAt.getTime(),
    );
  const winners = contests.filter((c) => ["winner_selected", "handover", "completed"].includes(c.status)).length;
  const prizes = contests.filter((c) => !["draft", "pending_payment", "cancelled"].includes(c.status)).reduce((a, c) => a + c.prize, 0);
  const href = (over: { tab?: string; sort?: string }) => {
    const p = new URLSearchParams();
    const tb = over.tab ?? tab;
    const so = over.sort ?? sort;
    if (tb !== "all") p.set("tab", tb);
    if (so !== "action") p.set("sort", so);
    if (q) p.set("q", q);
    const s = p.toString();
    return `/client/contests${s ? `?${s}` : ""}`;
  };
  const left = (end: Date | null) => {
    const p = leftParts(end, now);
    return p ? t(p.unit === "d" ? "cw.time.daysLeft" : "cw.time.hoursLeft", { n: num(p.n) }) : t("cw.time.ended");
  };

  return (
    <>
      <div className="phd2">
        <div>
          <div className="dnl">
            <h1>{t("cw.menu.contests")}</h1>
          </div>
          <p>{t("cw.my.lead")}</p>
        </div>
        <Link href="/start" className="dbtn">
          <CwIcon name="plus" />
          {t("cw.menu.start")}
        </Link>
      </div>

      <div className="msum" data-summary>
        <div>
          <span className="pni w">
            <CwIcon name="grid" size={16} />
          </span>
          <div>
            <b>{num(contests.length)}</b>
            <em>{t("cw.my.sumContests")}</em>
          </div>
        </div>
        <div>
          <span className="pni g">
            <CwIcon name="eye" size={16} />
          </span>
          <div>
            <b>{num(contests.reduce((a, c) => a + c.entries, 0))}</b>
            <em>{t("cw.my.sumDesigns")}</em>
          </div>
        </div>
        <div>
          <span className="pni m">
            <CwIcon name="trophy" size={16} />
          </span>
          <div>
            <b>{num(winners)}</b>
            <em>{t("cw.my.sumWinners")}</em>
          </div>
        </div>
        <div>
          <span className="pni b">
            <CwIcon name="card" size={16} />
          </span>
          <div>
            <b>{taka(prizes)}</b>
            <em>{t("cw.my.sumPrizes")}</em>
          </div>
        </div>
      </div>

      <div className="mbar">
        <nav className="mtab" aria-label={t("cw.my.tabsLabel")}>
          {MY_TABS.map((k) => (
            <Link key={k} href={href({ tab: k })} className={k === tab ? "on" : undefined} aria-current={k === tab ? "page" : undefined} scroll={false} data-tab={k}>
              {t(`cw.my.tabs.${k}`)}
              <em>{num(counts[k])}</em>
            </Link>
          ))}
        </nav>
        <form action="/client/contests" className="psr" role="search">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          {sort !== "action" && <input type="hidden" name="sort" value={sort} />}
          <CwIcon name="search" />
          <input type="search" name="q" defaultValue={q} placeholder={t("cw.my.search")} aria-label={t("cw.my.search")} />
        </form>
        <SortSelect id="cw-sort" label={t("cw.my.sort")} value={sort} options={MY_SORTS.map((s) => ({ value: s, label: t(`cw.my.sorts.${s}`), href: href({ sort: s }) }))} />
      </div>

      {list.length === 0 && contests.length > 0 && <Empty title={t("cw.my.noMatch")} lead={t("cw.my.noMatchLead")} />}
      <div className="mgrid" data-contest-list>
        {list.map((c) => {
          const paused = claims.get(c.id) === "pending";
          // A bKash payment sent and waiting for an admin (owner, 2026-10-25): nothing left to pay.
          const sent = waiting.has(c.id);
          const act = paused && mainAction(c.status) === "pick" ? "details" : mainAction(c.status, sent);
          const stages = contestStages(c.status);
          const actHref = act === "pay" || act === "waiting" ? payHref(c.id, waiting) : act === "review" ? contestHref(c.slug, "designs") : act === "pick" ? contestHref(c.slug, "designs", { sort: "top" }) : act === "files" ? contestHref(c.slug, "payment") : contestHref(c.slug);
          const kind = myTabOf(c.status);
          const line =
            c.status === "open"
              ? left(c.endsAt)
              : c.status === "judging"
                ? paused
                  ? t("guarantee.status.title")
                  : t("cw.home.pickWithin", { left: left(c.judgingEndsAt) })
                : kind === "unpaid"
                  ? t(sent ? "cw.my.waitingStep" : "cw.my.briefStep")
                  : c.status === "completed"
                    ? t("cw.my.filesReady")
                    : t(`cw.status.${c.status}` as Parameters<typeof t>[0]);
          return (
            <article key={c.id} className={`mcc ${kind === "open" ? "op" : kind === "pick" ? "pk" : kind === "unpaid" ? "dr" : "dn"}`} data-contest={c.slug}>
              <div className="mci">
                <Link href={contestHref(c.slug)} className="cover" aria-label={c.brandName}>
                  <Picture url={c.cover?.url ?? null} name={c.brandName} />
                </Link>
                <StatusPill status={c.status} waiting={sent} t={t} />
                {c.status === "open" && c.unrated > 0 && <span className="clnew">{t("cw.home.newN", { n: num(c.unrated) })}</span>}
              </div>
              <div className="mcb">
                <div className="mch">
                  <div>
                    <b>{c.brandName}</b>
                    <em>
                      {t(`wizard.businessTypes.${c.businessType}`)}
                      {c.number ? ` · LC-${String(c.number).padStart(4, "0")}` : ""} · {t("cw.my.started", { date: formatDate(c.startsAt ?? c.createdAt, locale, "short") })}
                    </em>
                  </div>
                  <span className="mpr">
                    {taka(c.prize)}
                    <em>{t("cw.my.prize")}</em>
                  </span>
                </div>
                <div className="mstat">
                  <span>
                    <b>{kind === "unpaid" ? "—" : num(c.entries)}</b>
                    {t("cw.my.designs")}
                  </span>
                  <span>
                    <b>{kind === "unpaid" ? "—" : num(c.designers)}</b>
                    {t("cw.my.designers")}
                  </span>
                  <span className="mw">{line}</span>
                </div>
                <ol className="mst" aria-label={t("cw.my.progress")}>
                  {STAGES.map((s, i) => (
                    <li key={s} className={stages[i]}>
                      <i />
                      <span>{t(`cw.stages.${s}`)}</span>
                    </li>
                  ))}
                </ol>
                <div className="mca">
                  <Link href={actHref} className="dbtn sm">
                    {t(`cw.action.${act}`)}
                  </Link>
                  <Link href={contestHref(c.slug)} className="dout sm" data-details>
                    {t("cw.my.details")}
                  </Link>
                  <Link href={`/client/messages?contest=${c.slug}`} className="dic sm" aria-label={t("cw.menu.messages")}>
                    <CwIcon name="chat" size={18} />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
        <Link href="/start" className="mnew">
          <span>
            <CwIcon name="plus" size={22} />
          </span>
          <b>{t("cw.my.newTitle")}</b>
          <em>{t("cw.my.newLead")}</em>
        </Link>
      </div>
    </>
  );
}

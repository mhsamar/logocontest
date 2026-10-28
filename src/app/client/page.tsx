import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { redirect } from "next/navigation";
import { CwIcon } from "@/components/client/icons";
import { BasicChip, CheckChip, Empty, Picture, ProChip, ProOnPicture, StatusPill } from "@/components/client/parts";
import { ShortlistHeart } from "@/components/client/review-buttons";
import { ClientAvatar } from "@/components/client/avatar-menu";
import { getCurrentUser } from "@/lib/auth/session";
import { agoParts, contestHref, leftParts, mainAction, progressShare } from "@/lib/client/rules";
import { clientHome, clientShell, payHref } from "@/lib/client/workspace";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("cw.home.metaTitle"), robots: { index: false } };
}

const FRESH = ["all", "pro", "checked"] as const;

// Premium client workspace › Dashboard (owner, 2026-10-16; Design/client-premium/client-dashboard.html). Real data
// only: every number comes from the client's own contests, designs, chats and checks.
export default async function ClientDashboardPage({ searchParams }: PageProps<"/client">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=client&next=%2Fclient");
  if (user.role !== "client") redirect("/dashboard");
  const sp = await searchParams;
  const [{ t, locale }, h, shell] = await Promise.all([getI18n(), clientHome(user), clientShell(user)]);
  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const now = new Date();
  const fresh = FRESH.find((f) => f === sp.fresh) ?? "all";
  const freshList = (fresh === "pro" ? [...h.fresh].sort((a, b) => Number(b.pro) - Number(a.pro) || b.number - a.number) : fresh === "checked" ? h.fresh.filter((e) => e.badge.kind === "checked") : h.fresh).slice(0, 6);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Dhaka" }).format(now));
  const greet = hour < 12 ? "cw.home.morning" : hour < 17 ? "cw.home.afternoon" : "cw.home.evening";
  const first = user.name.trim().split(/\s+/)[0] || user.name;
  const ends = leftParts(h.nextEnd, now);
  const left = (end: Date | null) => {
    const p = leftParts(end, now);
    return p ? t(p.unit === "d" ? "cw.time.daysLeft" : "cw.time.hoursLeft", { n: num(p.n) }) : t("cw.time.ended");
  };
  const ago = (iso: string) => {
    const p = agoParts(new Date(iso), now);
    return t(`cw.time.ago.${p.unit}`, { n: num(p.n) });
  };
  const ring = h.checks ? Math.round((h.checks.left / Math.max(1, h.checks.limit)) * 314) : 0;

  return (
    <>
      {/* Hero */}
      <section className="chero">
        <span className="cha a" />
        <span className="cha b" />
        <span className="cha c" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <i key={i} className={`chs s${i}`} />
        ))}
        <div className="chl">
          <span className="chk">
            <CwIcon name="crown" size={14} />
            {t("cw.shell.kicker")}
          </span>
          <h1>{t(greet, { name: first })}</h1>
          <p>
            {h.unrated > 0 ? t("cw.home.statusRate", { n: num(h.unrated) }) : h.live.length ? t("cw.home.statusWorking") : t("cw.home.statusNone")}
            {ends ? ` ${t(ends.unit === "d" ? "cw.home.endsDays" : "cw.home.endsHours", { n: num(ends.n) })}` : ""}
          </p>
          <div className="chb">
            <Link href={shell.links.review ?? "/client/contests"} className="dwhite">
              <CwIcon name="eye" />
              {t("cw.home.reviewNew")}
            </Link>
            <Link href="/start" className="pgl">
              <CwIcon name="plus" />
              {t("cw.menu.start")}
            </Link>
          </div>
        </div>
        <div className="chr">
          <div className="chg">
            <span>{t("cw.home.received")}</span>
            <b>{num(h.designs)}</b>
            <em>{t("cw.home.across", { n: num(h.designsIn) })}</em>
          </div>
          <div className="chg">
            <span>{t("cw.home.joined")}</span>
            <b>{num(h.designers)}</b>
            <em>{t("cw.home.proJoined", { n: num(h.proDesigners) })}</em>
          </div>
          <div className="chg">
            <span>{t("cw.home.held")}</span>
            <b>{taka(h.prizeHeld)}</b>
            <em>{t("cw.home.heldHint")}</em>
          </div>
        </div>
      </section>

      <div className="cg2">
        {/* Live contests */}
        <section className="dcard" data-live-contests>
          <div className="dch">
            <h2>{t("cw.home.live")}</h2>
            <Link href="/client/contests" className="dlink sm" title={t("cw.home.seeAllHint")} data-see-all>
              {t("cw.home.seeAll")}
              <CwIcon name="arrow" size={16} />
            </Link>
          </div>
          {h.live.length === 0 ? (
            <Empty title={t("cw.home.noLive")} lead={t("cw.home.noLiveLead")}>
              <Link href="/start" className="dbtn sm">
                {t("cw.menu.start")}
              </Link>
            </Empty>
          ) : (
            <div className="clg">
              {h.live.map((c) => {
                // A money-back claim being checked pauses picking (owner, 2026-10-21).
                const paused = h.claiming.includes(c.id);
                // A bKash payment sent and waiting for an admin (owner, 2026-10-25): nothing left to pay.
                const waiting = h.payLinks.has(c.id);
                const act = paused && mainAction(c.status) === "pick" ? "details" : mainAction(c.status, waiting);
                const href = act === "pay" || act === "waiting" ? payHref(c.id, h.payLinks) : act === "review" ? contestHref(c.slug, "designs") : act === "pick" ? contestHref(c.slug, "designs", { sort: "top" }) : act === "files" ? contestHref(c.slug, "payment") : contestHref(c.slug);
                return (
                  <article key={c.id} className="clc">
                    <div className="clci">
                      <Picture url={c.cover?.url ?? null} name={c.brandName} />
                      <StatusPill status={c.status} waiting={waiting} t={t} />
                      {c.status === "open" && c.unrated > 0 && <span className="clnew">{t("cw.home.newN", { n: num(c.unrated) })}</span>}
                    </div>
                    <div className="clcb">
                      <b>{c.brandName}</b>
                      <em>
                        {t(`wizard.businessTypes.${c.businessType}`)} · {taka(c.prize)}
                      </em>
                      <div className="clm">
                        {c.status === "draft" || c.status === "pending_payment" ? (
                          <>
                            <span>{t(waiting ? "cw.home.paySent" : "cw.home.briefReady")}</span>
                            <span>{t(waiting ? "cw.home.goesLive" : "cw.home.payToGo")}</span>
                          </>
                        ) : (
                          <>
                            <span>{t("cw.home.designsN", { n: num(c.entries) })}</span>
                            <span>{paused ? t("guarantee.status.title") : c.status === "judging" ? t("cw.home.pickWithin", { left: left(c.judgingEndsAt) }) : c.status === "open" ? left(c.endsAt) : t(`cw.status.${c.status}` as Parameters<typeof t>[0])}</span>
                          </>
                        )}
                      </div>
                      <i className="clp">
                        <s style={{ width: `${progressShare(c.status)}%` }} />
                      </i>
                      <Link href={href} className="dbtn sm wide">
                        {t(`cw.action.${act}`)}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* To do */}
        <section className="dcard cact" data-todo>
          <div className="dch">
            <h2>{t("cw.home.todo")}</h2>
            {h.todo.length > 0 && <span className="dnew">{num(h.todo.length)}</span>}
          </div>
          {h.todo.length === 0 ? (
            <Empty title={t("cw.home.todoNone")} lead={t("cw.home.todoNoneLead")} />
          ) : (
            h.todo.slice(0, 5).map((x, i) => (
              <div key={i} className="cto">
                <span className={`pni ${x.kind === "pick" ? "m" : x.kind === "rate" ? "g" : "w"}`}>
                  <CwIcon name={x.kind === "pick" ? "trophy" : x.kind === "rate" ? "eye" : x.kind === "pay" ? "card" : "download"} size={16} />
                </span>
                <div>
                  <b>{t(`cw.todo.${x.kind}`, { n: num(x.n) })}</b>
                  <em>{x.kind === "pick" && x.until ? t("cw.todo.pickLine", { brand: x.brand, date: formatDate(x.until, locale, "short") }) : t(`cw.todo.${x.kind}Line`, { brand: x.brand })}</em>
                </div>
                <Link href={x.href} className="dout sm">
                  {t(`cw.todo.${x.kind}Button`)}
                </Link>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Fresh designs */}
      <section className="dcard" data-fresh>
        <div className="dch">
          <h2>{t("cw.home.fresh")}</h2>
          <div className="efl">
            {FRESH.map((f) => (
              <Link key={f} href={f === "all" ? "/client" : `/client?fresh=${f}`} className={f === fresh ? "on" : undefined} scroll={false}>
                {t(`cw.home.freshFilters.${f}`)}
              </Link>
            ))}
          </div>
        </div>
        {freshList.length === 0 ? (
          <Empty title={t("cw.home.freshNone")} lead={t("cw.home.freshNoneLead")} />
        ) : (
          <div className="cfg">
            {freshList.map((e) => (
              <div key={e.id} className="cfr">
                <div className="cfri">
                  <Link href={contestHref(e.contestSlug, "designs", { entry: e.number })} className="cover" aria-label={t("entry.open", { n: num(e.number) })}>
                    <Picture url={e.previews[0] ?? null} name={e.brand} />
                  </Link>
                  {e.showPro && <ProOnPicture />}
                  <ShortlistHeart entryId={e.id} on={e.isShortlisted} />
                </div>
                <div className="cfrb">
                  <b>{e.designer?.username ? `@${e.designer.username}` : (e.designer?.name ?? t("entry.hiddenName"))}</b>
                  {e.showPro ? <ProChip trial={e.trial} t={t} /> : <BasicChip t={t} />}
                </div>
                <CheckChip badge={e.badge} t={t} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="cg3">
        {/* Designers you talk to */}
        <section className="dcard" data-talk>
          <div className="dch">
            <h2>{t("cw.home.talk")}</h2>
            <Link href="/client/messages" className="dlink sm">
              {t("cw.home.open")}
              <CwIcon name="arrow" size={16} />
            </Link>
          </div>
          {h.threads.length === 0 ? (
            <Empty title={t("cw.home.talkNone")} lead={t("cw.home.talkNoneLead")} />
          ) : (
            h.threads.map((th) => (
              <Link key={th.entryId} href={`/client/messages?entry=${th.entryId}`} className="cdt">
                <span className="psav sm">
                  <span className="dring" />
                  <ClientAvatar name={th.other.name} url={th.other.avatarUrl} />
                </span>
                <div>
                  <b>{th.other.name}</b>
                  <em>{th.last || t("pro.chat.about", { brand: th.brand, n: th.entryNumber })}</em>
                </div>
                <span className="cdt2">{ago(th.lastAt)}</span>
              </Link>
            ))
          )}
        </section>

        {/* Logo checks */}
        <section className="dcard" data-checks>
          <div className="dch">
            <h2>{t("cw.shell.checks")}</h2>
          </div>
          {h.checks ? (
            <>
              <div className="pring cpr">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <defs>
                    <linearGradient id="cw-ring" x1="0" x2="1">
                      <stop offset="0" stopColor="#14633C" />
                      <stop offset="1" stopColor="#2BB673" />
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r="50" className="rbk" />
                  <circle cx="60" cy="60" r="50" className="rf" stroke="url(#cw-ring)" strokeDasharray={`${ring} 314`} />
                </svg>
                <b>
                  {num(h.checks.left)}
                  <em>{t("cw.home.ofLeft", { n: num(h.checks.limit) })}</em>
                </b>
              </div>
              <p className="phint c">{t("cw.home.checksRule")}</p>
              <Link href={contestHref(h.checks.slug, "designs")} className="dbtn sm wide">
                <CwIcon name="shield" size={16} />
                {t("cw.shell.checkLogo")}
              </Link>
            </>
          ) : (
            <Empty title={t("cw.home.checksNone")} lead={t("cw.home.checksRule")} />
          )}
        </section>

        {/* Files & certificates */}
        <section className="dcard" id="files" data-files>
          <div className="dch">
            <h2>{t("cw.menu.files")}</h2>
          </div>
          {h.files.length === 0 ? (
            <Empty title={t("cw.home.filesNone")} lead={t("cw.home.filesNoneLead")} />
          ) : (
            h.files.map((f) => (
              <div key={f.slug} className="cfl">
                <span className="psvi sm2">
                  <Picture url={f.cover} name={f.brand} />
                </span>
                <div>
                  <b>{f.brand}</b>
                  <em>{t(`cw.files.${f.status === "approved" ? "ready" : f.status === "submitted" ? "check" : f.status === "no_result" ? "noResult" : "waiting"}`)}</em>
                </div>
                <Link href={f.href} className="dic sm" aria-label={t("cw.files.open", { brand: f.brand })}>
                  <CwIcon name="download" size={18} />
                </Link>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}

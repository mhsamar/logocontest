/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { redirect } from "next/navigation";
import { Icon, Slot, SmallAvatar } from "@/components/pro/parts";
import { ProWorkspace, WsHead } from "@/components/pro/workspace";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { chatThreads } from "@/lib/pro/chat";
import { proInsights } from "@/lib/pro/insights";
import { designerCheckUsage } from "@/lib/pro/logo-checks";
import { getProSettings } from "@/lib/pro/settings";
import { getSubscription, isPro } from "@/lib/pro/status";
import { portfolioCount } from "@/lib/pro/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pro.insights.title"), robots: { index: false } };
}

const DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const DAYS_BN = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"];

// Pro › Insights (owner, 2026-10-13; Design/pro/pro-insights.html): private numbers from real views and contests.
export default async function InsightsPage({ searchParams }: PageProps<"/dashboard/insights">) {
  const [{ t, locale, price }, user, sp] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);
  if (!user) redirect("/login?as=designer&next=%2Fdashboard%2Finsights");
  if (user.role !== "designer" || !(await isPro(user.id))) redirect("/pro");
  const { settings } = await getProSettings();
  const days = sp.range === "7" ? 7 : sp.range === "90" ? 90 : 30;
  const [ins, usage, sub, slots, threads] = await Promise.all([proInsights(user.id, user.username, days), designerCheckUsage(user.id), getSubscription(user.id), portfolioCount(user.id), chatThreads(user)]);
  const n = (v: number) => formatNumber(v, locale);
  const pct = (v: number) => `${n(v)}%`;
  const reply = ins.replyMinutes === null ? t("pro.insights.noReply") : ins.replyMinutes < 60 ? t("pro.insights.minutes", { n: n(ins.replyMinutes) }) : ins.replyMinutes < 1440 ? t("pro.insights.hours", { n: n(Math.round(ins.replyMinutes / 60)) }) : t("pro.insights.days", { n: n(Math.round(ins.replyMinutes / 1440)) });
  const maxDay = Math.max(1, ...ins.perDay.map((d) => d.design + d.profile));
  const maxHeat = Math.max(1, ...ins.heat.flat());
  const maxSrc = Math.max(1, ...ins.sources.map((s) => s.count));
  const f = ins.funnel;
  const hourLabel = (slot: number) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, slot * 2)));

  if (!settings.features.insights)
    return (
      <ProWorkspace user={user} active="insights">
        <WsHead title={t("pro.insights.title")} />
        <p className="pr-empty">{t("pro.insights.off")}</p>
      </ProWorkspace>
    );

  return (
    <ProWorkspace user={user} active="insights">
      <WsHead
        title={t("pro.insights.title")}
        lead={t("pro.insights.lead")}
        action={
          <nav className="pr-rng" aria-label={t("pro.insights.title")}>
            {([7, 30, 90] as const).map((d) => (
              <Link key={d} href={`/dashboard/insights?range=${d}`} className={days === d ? "on" : undefined} aria-current={days === d ? "true" : undefined}>
                {t("pro.insights.range", { n: n(d) })}
              </Link>
            ))}
          </nav>
        }
      />
      <div className="pr-g2">
        <section className="pr-hero">
          <span className="pr-blob b1" aria-hidden />
          <div>
            <span className="lbl">{t("pro.insights.total", { n: n(days) })}</span>
            <div className="big">
              <b>{n(ins.total)}</b>
              {ins.change !== null && <span className="pr-chg">{`${ins.change > 0 ? "+" : ""}${n(ins.change)}%`}</span>}
            </div>
          </div>
          <div className="row4">
            <div>
              <span>{t("pro.insights.designViews")}</span>
              <b>{n(ins.designViews)}</b>
            </div>
            <div>
              <span>{t("pro.insights.profileViews")}</span>
              <b>{n(ins.profileViews)}</b>
            </div>
            <div>
              <span>{t("pro.insights.shortlists")}</span>
              <b>{n(ins.shortlists)}</b>
            </div>
            <div>
              <span>{t("pro.insights.wins")}</span>
              <b>{n(ins.wins)}</b>
            </div>
          </div>
        </section>
        <div className="pr-k4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="pr-k">
            <b>{pct(ins.winRate)}</b>
            <span>{t("pro.insights.winRate")}</span>
          </div>
          <div className="pr-k">
            <b>{ins.rating === null ? "—" : n(ins.rating)}</b>
            <span>{ins.rating === null ? t("pro.insights.noRating") : t("pro.insights.rating")}</span>
          </div>
          <div className="pr-k">
            <b style={{ fontSize: ins.replyMinutes === null ? 20 : undefined }}>{reply}</b>
            <span>{t("pro.insights.reply")}</span>
          </div>
          <div className="pr-k">
            <b>{n(usage.left)}</b>
            <span>
              {t("pro.insights.checksLeft")} · {t("pro.insights.ofN", { n: n(usage.limit) })}
            </span>
          </div>
        </div>
      </div>

      <div className="pr-g2">
        <section className="pr-card" aria-labelledby="ins-chart">
          <div className="pr-ch">
            <h2 id="ins-chart">{t("pro.insights.chart")}</h2>
          </div>
          {ins.total === 0 ? (
            <p className="pr-empty">{t("pro.insights.noData")}</p>
          ) : (
            <>
              <div className="pr-bars" role="img" aria-label={t("pro.insights.chart")}>
                {ins.perDay.map((d) => (
                  <span key={d.day} className="d" title={`${formatDate(new Date(`${d.day}T06:00:00Z`), locale, "short")}: ${n(d.design)} · ${n(d.profile)}`}>
                    <i className="g" style={{ height: `${(d.profile / maxDay) * 100}%` }} />
                    <i className="m" style={{ height: `${(d.design / maxDay) * 100}%` }} />
                  </span>
                ))}
              </div>
              <div className="pr-lg">
                <span>
                  <i style={{ background: "#8B0000" }} />
                  {t("pro.insights.designViews")}
                </span>
                <span>
                  <i style={{ background: "#E2B13C" }} />
                  {t("pro.insights.profileViews")}
                </span>
                <span>{t("pro.insights.chartHint")}</span>
              </div>
            </>
          )}
        </section>
        <section className="pr-card" aria-labelledby="ins-funnel">
          <div className="pr-ch">
            <h2 id="ins-funnel">{t("pro.insights.funnel")}</h2>
          </div>
          {(
            [
              ["pro.insights.fViews", f.views],
              ["pro.insights.fOpened", f.opened],
              ["pro.insights.fRated", f.rated],
              ["pro.insights.fShortlisted", f.shortlisted],
              ["pro.insights.fWon", f.won],
            ] as [MessageKey, number][]
          ).map(([label, v]) => (
            <div key={label} className="pr-fb">
              <div>
                <span>{t(label)}</span>
                <b>{n(v)}</b>
              </div>
              <i>
                <s style={{ width: `${f.views ? Math.max(v ? 3 : 0, (v / f.views) * 100) : 0}%` }} />
              </i>
            </div>
          ))}
          <p className="pr-mut" style={{ marginTop: 8 }}>
            {t("pro.insights.tip")}
          </p>
        </section>
      </div>

      <div className="pr-g3">
        <section className="pr-card" aria-labelledby="ins-src">
          <div className="pr-ch">
            <h2 id="ins-src">{t("pro.insights.sources")}</h2>
          </div>
          {ins.sources.length === 0 && <p className="pr-empty">{t("pro.insights.noData")}</p>}
          {ins.sources.map((s) => (
            <div key={s.source} className="pr-fb">
              <div>
                <span>{t(`pro.insights.src.${s.source}` as MessageKey)}</span>
                <b>{pct(Math.round((s.count / Math.max(1, ins.total)) * 100))}</b>
              </div>
              <i>
                <s style={{ width: `${(s.count / maxSrc) * 100}%` }} />
              </i>
            </div>
          ))}
        </section>
        <section className="pr-card" aria-labelledby="ins-heat">
          <div className="pr-ch">
            <h2 id="ins-heat">{t("pro.insights.heat")}</h2>
          </div>
          <div className="pr-heat" role="img" aria-label={t("pro.insights.heat")}>
            {ins.heat.map((row, d) => [
              <span key={`l${d}`}>{(locale === "bn" ? DAYS_BN : DAYS)[d]}</span>,
              ...row.map((v, i) => <i key={`${d}-${i}`} style={v ? { background: `rgba(139,0,0,${0.15 + (0.85 * v) / maxHeat})` } : undefined} />),
            ])}
          </div>
          <div className="pr-heatx">
            <span>{hourLabel(0)}</span>
            <span>{hourLabel(3)}</span>
            <span>{hourLabel(6)}</span>
            <span>{hourLabel(9)}</span>
            <span>{hourLabel(11)}</span>
          </div>
          <p className="pr-mut" style={{ marginTop: 10 }}>
            {t("pro.insights.heatHint")} {ins.bestSlot !== null && t("pro.insights.best", { from: hourLabel(ins.bestSlot), to: hourLabel((ins.bestSlot + 1) % 12) })}
          </p>
        </section>
        <section className="pr-card" aria-labelledby="ins-boost">
          <div className="pr-ch">
            <h2 id="ins-boost">{t("pro.insights.boost")}</h2>
            <span className="pr-pill op">{t("pro.insights.on")}</span>
          </div>
          {(
            [
              ["pro.insights.bHigher", "pro.insights.bHigherSub", null],
              ["pro.insights.bAlerts", "pro.insights.bAlertsSub", null],
              ["pro.insights.bSlots", null, [slots, settings.proPortfolioLimit]],
              ["pro.insights.bChecks", "pro.insights.bChecksSub", [usage.used, usage.limit]],
              ["pro.insights.bSupport", "pro.insights.bSupportSub", null],
            ] as [MessageKey, MessageKey | null, [number, number] | null][]
          ).map(([title, sub, bar]) => (
            <div key={title} className="pr-li">
              <span className="pr-ic w">
                <Icon name="check" strokeWidth={2.8} />
              </span>
              <div>
                <b>{t(title)}</b>
                <em>{sub ? t(sub, { left: n(usage.left), max: n(usage.limit) }) : t("pro.settings.slotsLine", { used: n(bar![0]), max: n(bar![1]) })}</em>
                {bar && <Slot used={bar[0]} max={bar[1]} />}
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="pr-g2">
        <section className="pr-card" aria-labelledby="ins-top">
          <div className="pr-ch">
            <h2 id="ins-top">{t("pro.insights.top")}</h2>
            <span className="pr-mut">{t("pro.insights.lastN", { n: n(days) })}</span>
          </div>
          {ins.top.length === 0 ? (
            <p className="pr-empty">{t("pro.insights.noData")}</p>
          ) : (
            <div className="pr-tbl">
              <div className="pr-tr th">
                <span />
                <span>{t("pro.insights.hDesign")}</span>
                <span>{t("pro.insights.hViews")}</span>
                <span>{t("pro.insights.hShortlists")}</span>
                <span>{t("pro.insights.hRating")}</span>
              </div>
              {ins.top.map((d) => (
                <Link key={d.id} href={`/contest/${d.slug}?tab=entries&entry=${d.number}`} className="pr-tr" style={{ color: "inherit" }}>
                  <span className="pr-thumb">{d.thumb ? <img src={d.thumb} alt="" /> : null}</span>
                  <span className="n">
                    <b>{d.brand || t("pro.contests.privateContest")}</b>
                    <em>{d.won ? t("pro.dash.status.won") : d.shortlisted ? t("pro.dash.status.shortlisted") : `#${d.number}`}</em>
                  </span>
                  <span>{n(d.views)}</span>
                  <span>{d.shortlisted ? "✓" : "—"}</span>
                  <span>{d.rating ? `${n(d.rating)}★` : "—"}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="pr-card" aria-labelledby="ins-msg">
          <div className="pr-ch">
            <h2 id="ins-msg">{t("pro.insights.messages")}</h2>
            {threads.some((x) => x.unread) && <span className="pr-new">{t("pro.dash.newN", { n: n(threads.filter((x) => x.unread).length) })}</span>}
          </div>
          {threads.length === 0 && <p className="pr-empty">{t("pro.chat.emptyDesigner")}</p>}
          {threads.slice(0, 3).map((th) => (
            <Link key={th.entryId} href={`/dashboard/messages?entry=${th.entryId}`} className="pr-li" style={{ color: "inherit" }}>
              <SmallAvatar name={th.other.name} url={th.other.avatarUrl} />
              <div>
                <b>{th.other.name}</b>
                <em>{th.last}</em>
              </div>
            </Link>
          ))}
          {settings.features.client_chat && (
            <Link href="/dashboard/messages" className="pr-out" style={{ marginTop: "auto" }}>
              {t("pro.insights.openMessages")}
            </Link>
          )}
        </section>
      </div>

      {sub && (
        <section className="pr-lc">
          <span className="ic">
            <Icon name="crown" size={26} />
          </span>
          <div>
            <b>{t("pro.insights.sub", { price: price(settings.priceBdt) })}</b>
            <em>{sub.status === "cancelled" ? t("pro.insights.subCancelled", { date: formatDate(sub.currentPeriodEnd, locale, "long") }) : t("pro.insights.subLine", { date: formatDate(sub.currentPeriodEnd, locale, "long") })}</em>
          </div>
          <Link href="/dashboard/profile#subscription" className="pr-out sm">
            {t("pro.insights.manage")}
          </Link>
          <Link href="/dashboard/wallet#receipts" className="pr-out sm">
            {t("pro.insights.receipts")}
          </Link>
        </section>
      )}
    </ProWorkspace>
  );
}

/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRemindToggle, GrantPro, ManageMember, MasterSwitch, PlanSettings, RemindButton, GiveTrial, TrialActions } from "@/components/pro/admin-pro-client";
import { trialOverview } from "@/lib/pro/trial-admin";
import "@/components/pro/admin-pro.css";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { formatDate, timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { proOverview, type MemberStatus } from "@/lib/pro/admin-queries";
import { getProSettings } from "@/lib/pro/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pro.admin.title"), robots: { index: false } };
}

const STATUS_TONE: Record<MemberStatus, string> = { active: "ok", expiring: "warn", payment_failed: "fail", cancelled: "off", expired: "off" };
const CHIPS = ["all", "active", "expiring", "payment_failed", "cancelled", "expired"] as const;
/** datetime-local value in Bangladesh time. */
const local = (d: Date | null) => (d ? new Date(d.getTime() + 6 * 3_600_000).toISOString().slice(0, 16) : "");

// Admin › Pro plan (owner, 2026-10-13; Design/pro/admin-pro-plan.html): the master switch, plan settings, the funnel,
// clicked-but-did-not-buy, members with Manage, best results, why they cancel and the activity log. Real data only.
export default async function AdminProPage({ searchParams }: PageProps<"/admin/pro">) {
  const admin = await requirePermission("pro.view");
  const canManage = hasPermission(admin, "pro.manage");
  const sp = await searchParams;
  const range = sp.range === "7" ? 7 : sp.range === "90" ? 90 : 30;
  const chip = CHIPS.find((c) => c === sp.members) ?? "all";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 40) : "";
  const [{ t, locale }, { settings: s, ready }, o, trials] = await Promise.all([getI18n(), getProSettings(), proOverview(range), trialOverview()]);
  const n = (v: number) => formatNumber(v, locale);
  const pct = (v: number) => `${n(v)}%`;
  const now = new Date();
  const qs = (p: Record<string, string | number | null>) => {
    const u = new URLSearchParams({ range: String(range), members: chip, ...(q ? { q } : {}) });
    for (const [k, v] of Object.entries(p)) {
      if (v === null) u.delete(k);
      else u.set(k, String(v));
    }
    return `/admin/pro?${u}`;
  };
  const members = o.members.filter((m) => (chip === "all" || m.status === chip) && (!q || m.name.toLowerCase().includes(q) || (m.username ?? "").includes(q)));
  const quality = (v: number | null) => (v === null ? "none" : v >= 80 ? "top" : v >= 65 ? "high" : v >= 45 ? "good" : "low");
  const F = o.funnel;
  const share = (v: number, total: number) => (total ? Math.round((v / total) * 100) : 0);
  const reasonsTotal = o.reasons.reduce((a, r) => a + r.count, 0);
  const describe = (a: (typeof o.activity)[number]) => {
    const vals = { designer: a.designer ?? "—", from: JSON.stringify(a.oldValue ?? "—"), to: JSON.stringify(a.newValue ?? "—"), field: a.action.replace(/^set_/, "") };
    const key = `pro.admin.actions.${a.action}`;
    const known = ["set_is_for_sale", "set_price_bdt", "gave_free_month", "extended", "changed_end_date", "admin_cancelled", "member_cancelled", "paid", "renewed", "expired", "trial_started", "reminded", "renewal_reminders", "price_notice_sent", "chat_flagged", "admin_started_trial", "trial_cancelled", "admin_cancelled_trial", "admin_extended_trial", "trial_expired", "admin_removed_invite"];
    if (a.action === "set_is_for_sale") return t("pro.admin.actions.set_is_for_sale", { to: a.newValue ? t("pro.admin.on") : t("pro.admin.off") });
    if (a.action === "set_price_bdt") return t("pro.admin.actions.set_price_bdt", { from: `৳${a.oldValue}`, to: `৳${a.newValue}` });
    return known.includes(a.action) ? t(key as MessageKey, vals) : t("pro.admin.actions.changed", vals);
  };

  return (
    <div className="ap">
      <div className="ap-top">
        <div style={{ flex: "1 1 360px" }}>
          <h1 className="lc-d m-0 text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink">{t("pro.admin.title")}</h1>
          <p className="m-0 text-[15.5px] text-muted">{t("pro.admin.lead")}</p>
        </div>
        <Link href="/admin/pro/invitations" className="ap-btn ghost">
          {t("pro.invitesAdmin.title")}
        </Link>
        <Link href="/pro" target="_blank" className="ap-btn ghost">
          {t("pro.admin.preview")}
        </Link>
      </div>
      {!ready ? (
        <p className="ap-warn">{t("pro.admin.notReady")}</p>
      ) : (
        <>
          <MasterSwitch on={s.isForSale} canManage={canManage} />
          <div className="ap-k">
            <div className="ap-kc">
              <span>{t("pro.admin.kActive")}</span>
              <b>{n(o.kpi.active)}</b>
              <em className="up">{t("pro.admin.kActiveSub", { n: n(o.kpi.newThisMonth) })}</em>
            </div>
            <div className="ap-kc">
              <span>{t("pro.admin.kIncome")}</span>
              <b>{formatTaka(o.kpi.income, locale)}</b>
              <em className={o.kpi.incomeChange !== null && o.kpi.incomeChange < 0 ? "dn" : "up"}>{o.kpi.incomeChange === null ? t("pro.admin.kIncomeNone") : t("pro.admin.kIncomeSub", { n: `${o.kpi.incomeChange > 0 ? "+" : ""}${n(o.kpi.incomeChange)}` })}</em>
            </div>
            <div className="ap-kc">
              <span>{t("pro.admin.kRate")}</span>
              <b>{pct(o.kpi.upgradeRate)}</b>
              <em>{t("pro.admin.kRateSub")}</em>
            </div>
            <div className="ap-kc">
              <span>{t("pro.admin.kCancelled")}</span>
              <b>{n(o.kpi.cancelled)}</b>
              <em className="dn">{t("pro.admin.kCancelledSub", { n: n(o.kpi.cancelledShare) })}</em>
            </div>
            <div className="ap-kc">
              <span>{t("pro.admin.kFailed")}</span>
              <b>{n(o.kpi.failed)}</b>
              <em className="dn">{t("pro.admin.kFailedSub")}</em>
            </div>
            <div className="ap-kc">
              <span>{t("pro.admin.kRenew")}</span>
              <b>{o.kpi.renewRate === null ? "—" : pct(o.kpi.renewRate)}</b>
              <em>{o.kpi.renewRate === null ? t("pro.admin.kRenewNone") : t("pro.admin.kRenewSub")}</em>
            </div>
          </div>

          <PlanSettings
            canManage={canManage}
            initial={{
              priceBdt: s.priceBdt,
              offerEnabled: s.offerEnabled,
              offerPriceBdt: s.offerPriceBdt,
              offerAudience: s.offerAudience,
              offerStartsAt: local(s.offerStartsAt),
              offerEndsAt: local(s.offerEndsAt),
              trialDays: s.trialDays,
              promoCode: s.promoCode,
              promoPriceBdt: s.promoPriceBdt,
              proLogoChecks: s.proLogoChecks,
              basicLogoChecks: s.basicLogoChecks,
              checkLowMax: s.checkLowMax,
              checkMediumMax: s.checkMediumMax,
              freeTrialEnabled: s.freeTrialEnabled,
              freeTrialDays: s.freeTrialDays,
              trialLogoChecks: s.trialLogoChecks,
              trialPortfolioLimit: s.trialPortfolioLimit,
              proPortfolioLimit: s.proPortfolioLimit,
              proEntriesPerContest: s.proEntriesPerContest,
              basicEntriesPerContest: s.basicEntriesPerContest,
              invitesPerContest: s.invitesPerContest,
              earlyAccessMinutes: s.earlyAccessMinutes,
              features: s.features,
              autoRemind: s.autoRemind,
            }}
          />

          <section className="ap-c" aria-labelledby="ap-funnel">
            <div className="ap-h">
              <div>
                <h2 id="ap-funnel">{t("pro.admin.funnel")}</h2>
                <p>{t("pro.admin.funnelLead")}</p>
              </div>
              <nav className="ap-rng" aria-label={t("pro.admin.funnel")}>
                {[7, 30, 90].map((d) => (
                  <Link key={d} href={qs({ range: d })} className={range === d ? "on" : undefined}>
                    {t("pro.admin.range", { n: n(d) })}
                  </Link>
                ))}
              </nav>
            </div>
            {F.clicked === 0 && F.seen === 0 ? (
              <p className="ap-hint">{t("pro.admin.noFunnel")}</p>
            ) : (
              <div className="ap-g3">
                <div>
                  {(
                    [
                      ["pro.admin.f1", F.seen, null],
                      ["pro.admin.f2", F.clicked, ["pro.admin.d1", F.drops[0]]],
                      ["pro.admin.f3", F.checkout, ["pro.admin.d2", F.drops[1]]],
                      ["pro.admin.f4", F.paid, ["pro.admin.d3", F.drops[2]]],
                      ["pro.admin.f5", F.renewed, ["pro.admin.d4", F.drops[3]]],
                    ] as [MessageKey, number, [MessageKey, number] | null][]
                  ).map(([label, v, drop], i) => (
                    <div key={label} className="ap-fu">
                      <div className="ap-ful">
                        <span>
                          <i>{i + 1}</i>
                          {t(label)}
                        </span>
                        <b>{n(v)}</b>
                      </div>
                      <span className="ap-bar">
                        <s style={{ width: `${F.seen ? Math.max(v ? 2 : 0, (v / Math.max(F.seen, F.clicked)) * 100) : v ? 100 : 0}%` }} />
                      </span>
                      {drop && <em className="ap-drop">{t(drop[0], { n: n(drop[1]) })}</em>}
                    </div>
                  ))}
                </div>
                <div>
                  <b>{t("pro.admin.where")}</b>
                  {(
                    [
                      ["pro.admin.wClosed", o.whereStop.closed],
                      ["pro.admin.wFailed", o.whereStop.failed],
                      ["pro.admin.wChanged", o.whereStop.changed],
                      ["pro.admin.wBack", o.whereStop.cameBack],
                    ] as [MessageKey, number][]
                  ).map(([label, v]) => (
                    <div key={label} className="ap-sb">
                      <div>
                        <span>{t(label)}</span>
                        <b>{pct(share(v, o.whereStop.total))}</b>
                      </div>
                      <span className="ap-bar">
                        <s style={{ width: `${share(v, o.whereStop.total)}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <b>{t("pro.admin.when")}</b>
                  {(
                    [
                      ["pro.admin.tRight", o.whenStop.right],
                      ["pro.admin.tHour", o.whenStop.hour],
                      ["pro.admin.tDay", o.whenStop.day],
                      ["pro.admin.tLater", o.whenStop.later],
                    ] as [MessageKey, number][]
                  ).map(([label, v]) => (
                    <div key={label} className="ap-sb">
                      <div>
                        <span>{t(label)}</span>
                        <b>{pct(share(v, o.whenStop.total))}</b>
                      </div>
                      <span className="ap-bar gold">
                        <s style={{ width: `${share(v, o.whenStop.total)}%` }} />
                      </span>
                    </div>
                  ))}
                  {o.whenStop.total > 0 && <p className="ap-hint">{t("pro.admin.whenHint")}</p>}
                </div>
              </div>
            )}
          </section>

          <section className="ap-c" aria-labelledby="ap-clickers">
            <div className="ap-h">
              <div>
                <h2 id="ap-clickers">{t("pro.admin.clickers")}</h2>
                <p>{t("pro.admin.clickersLead")}</p>
              </div>
              <b>{t("pro.admin.clickersCount", { n: n(o.clickers.length) })}</b>
            </div>
            {o.clickers.length === 0 ? (
              <p className="ap-hint">{t("pro.admin.noClickers")}</p>
            ) : (
              <div className="ap-t">
                <div className="ap-r th">
                  <span />
                  <span>{t("pro.admin.hDesigner")}</span>
                  <span>{t("pro.admin.hClicked")}</span>
                  <span>{t("pro.admin.hStopped")}</span>
                  <span>{t("pro.admin.hTries")}</span>
                  <span>{t("pro.admin.hHistory")}</span>
                  <span />
                </div>
                {o.clickers.slice(0, 30).map((c) => (
                  <div key={c.designerId} className="ap-r">
                    <span className="ap-av">{c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : (c.name[0] ?? "?").toUpperCase()}</span>
                    <span className="ap-nm">
                      <b>{c.name || "—"}</b>
                      <em>{c.username ? `@${c.username}` : ""}</em>
                    </span>
                    <span>{timeAgo(new Date(c.clickedAt), now, locale)}</span>
                    <span>
                      <i className={`ap-st ${c.stoppedAt === "failed" ? "fail" : "warn"}`}>{t(`pro.admin.stop.${c.stoppedAt}`)}</i>
                    </span>
                    <span>{t("pro.admin.visits", { n: n(c.visits) })}</span>
                    <span className="ap-hint">{c.wasPro ? t("pro.admin.wasPro") : t("pro.admin.neverPro")}</span>
                    <span>
                      <RemindButton designerId={c.designerId} canManage={canManage && s.isForSale} />
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="ap-foot">
              <span>{t("pro.admin.autoRemind")}</span>
              <AutoRemindToggle on={s.autoRemind} canManage={canManage} />
            </div>
          </section>

          <section className="ap-c" aria-labelledby="ap-members">
            <div className="ap-h">
              <div>
                <h2 id="ap-members">{t("pro.admin.members")}</h2>
                <p>{t("pro.admin.membersLead")}</p>
              </div>
              <nav className="ap-chips" aria-label={t("pro.admin.members")}>
                {CHIPS.map((c) => (
                  <Link key={c} href={qs({ members: c })} className={chip === c ? "on" : undefined}>
                    {t(`pro.admin.chips.${c}`)} {n(o.counts[c])}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="ap-search">
              <form action="/admin/pro" className="ap-search">
                <input type="hidden" name="range" value={range} />
                <input type="hidden" name="members" value={chip} />
                <input name="q" defaultValue={q} placeholder={t("pro.admin.searchMember")} aria-label={t("pro.admin.searchMember")} />
              </form>
              <span className="ap-hint">{t("pro.admin.sortBest")}</span>
            </div>
            <GrantPro canManage={canManage} />
            {members.length === 0 ? (
              <p className="ap-hint">{t("pro.admin.noMembers")}</p>
            ) : (
              <div className="ap-t">
                <div className="ap-r m th">
                  <span />
                  <span>{t("pro.admin.hDesigner")}</span>
                  <span>{t("pro.admin.hStatus")}</span>
                  <span>{t("pro.admin.hRenews")}</span>
                  <span>{t("pro.admin.hWins")}</span>
                  <span>{t("pro.admin.hRate")}</span>
                  <span>{t("pro.admin.hChecks")}</span>
                  <span>{t("pro.admin.hQuality")}</span>
                  <span />
                </div>
                {members.map((m) => (
                  <div key={m.designerId} className="ap-r m">
                    <span className="ap-av">{m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : (m.name[0] ?? "?").toUpperCase()}</span>
                    <span className="ap-nm">
                      <b>{m.username ? <Link href={`/designer/${m.username}`}>{m.name}</Link> : m.name}</b>
                      <em>{t("pro.admin.since", { date: formatDate(new Date(m.since), locale, "month") })}</em>
                    </span>
                    <span>
                      <i className={`ap-st ${STATUS_TONE[m.status]}`}>{t(`pro.admin.chips.${m.status}`)}</i>
                    </span>
                    <span>{m.renews ? formatDate(new Date(m.renews), locale, "short") : "—"}</span>
                    <span>
                      {n(m.winsBefore)} → {n(m.winsAfter)}
                    </span>
                    <span className={m.rateChange > 0 ? "ap-good" : m.rateChange < 0 ? "ap-bad" : undefined}>{`${m.rateChange > 0 ? "+" : ""}${n(m.rateChange)}%`}</span>
                    <span>{n(m.checksUsed)}</span>
                    <span>{t(`pro.admin.quality.${quality(m.quality)}`)}</span>
                    <span>
                      <ManageMember designerId={m.designerId} name={m.name} status={m.status} canManage={canManage} />
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="ap-hint">{t("pro.admin.manageHint")}</p>
          </section>

          {/* 3-day free Pro Trial (owner, 2026-10-14): every trial, what it used, and how it ended */}
          <section className="ap-c" aria-labelledby="ap-trials" id="trials">
            <div className="ap-h">
              <div>
                <h2 id="ap-trials">{t("pro.trial.admin.title")}</h2>
                <p>{t("pro.trial.admin.lead")}</p>
              </div>
              <i className={`ap-st ${s.freeTrialEnabled ? "ok" : "off"}`}>{`${t("pro.trial.admin.switchTitle")}: ${s.freeTrialEnabled ? t("pro.admin.on") : t("pro.admin.off")}`}</i>
            </div>
            <div className="ap-k four" style={{ marginTop: 12 }}>
              {[
                [t("pro.trial.admin.kActive"), n(trials.active), ""],
                [t("pro.trial.admin.kUpgraded"), n(trials.upgraded), ""],
                [t("pro.trial.admin.kEnded"), n(trials.ended), ""],
                [t("pro.trial.admin.kRate"), trials.rate === null ? "—" : pct(trials.rate), t("pro.trial.admin.rateHint")],
              ].map(([label, value, hint]) => (
                <div key={label} className="ap-kc">
                  <span>{label}</span>
                  <b>{value}</b>
                  {hint && <em>{hint}</em>}
                </div>
              ))}
            </div>
            <GiveTrial canManage={canManage} />
            {trials.rows.length === 0 ? (
              <p className="ap-hint">{t("pro.trial.admin.none")}</p>
            ) : (
              <div className="ap-t">
                <div className="ap-r tr th">
                  <span>{t("pro.trial.admin.colDesigner")}</span>
                  <span>{t("pro.trial.admin.colDates")}</span>
                  <span>{t("pro.trial.admin.colStatus")}</span>
                  <span>{t("pro.trial.admin.colUse")}</span>
                  <span>{t("pro.trial.admin.colPayment")}</span>
                  <span>{t("pro.trial.admin.colReminders")}</span>
                  <span />
                </div>
                {trials.rows.map((r) => {
                  const live = r.status === "active" && r.endsAt > now;
                  const reminders = r.events.filter((e) => e.kind === "reminded");
                  return (
                    <div key={r.id} className="ap-r tr">
                      <span className="ap-nm">
                        <b>{r.designer.username ? <Link href={`/admin/users/${r.designer.id}`}>{r.designer.name}</Link> : r.designer.name}</b>
                        <em>{r.designer.username ? `@${r.designer.username}` : ""}{r.startedBy === "admin" ? ` · ${t("pro.trial.admin.byAdmin")}` : ""}</em>
                        <em>{t("pro.trial.admin.lifetime")}</em>
                      </span>
                      <span>
                        {formatDate(r.startedAt, locale, "short")} → {formatDate(r.endedAt && r.endedAt < r.endsAt ? r.endedAt : r.endsAt, locale, "short")}
                        {r.extendedDays > 0 && <em style={{ display: "block", fontStyle: "normal", fontSize: 12.5, color: "#6a6d76" }}>{r.extendedDays === 1 ? t("pro.trial.admin.extendedOne") : t("pro.trial.admin.extended", { n: n(r.extendedDays) })}</em>}
                      </span>
                      <span>
                        <i className={`ap-st ${live ? "ok" : r.status === "upgraded" ? "ok" : r.status === "cancelled" ? "fail" : "off"}`}>{t(`pro.trial.admin.status.${live || r.status !== "active" ? r.status : "expired"}`)}</i>
                      </span>
                      <span>
                        {n(r.checksUsed)} / {n(s.trialLogoChecks)} · {n(r.portfolioUploads)} / {n(s.trialPortfolioLimit)}
                      </span>
                      <span>{!r.payment ? t("pro.trial.admin.payNone") : r.payment.status === "paid" ? t("pro.trial.admin.payPaid", { amount: `৳${n(r.payment.amount)}` }) : r.payment.status === "failed" ? t("pro.trial.admin.payFailed") : t("pro.trial.admin.payPending")}</span>
                      <span>
                        {reminders.length === 0 ? (
                          <em style={{ fontStyle: "normal", color: "#6a6d76" }}>{t("pro.trial.admin.notReminded")}</em>
                        ) : (
                          reminders.map((e) => (
                            <em key={e.at} style={{ display: "block", fontStyle: "normal" }}>
                              {t("pro.trial.admin.reminded", { date: formatDate(new Date(e.at), locale, "short") })}
                            </em>
                          ))
                        )}
                        <span className="ap-ev" aria-label={t("pro.trial.admin.history")}>
                          {r.events.map((e) => (
                            <i key={`${e.kind}-${e.at}`} title={new Date(e.at).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}>
                              {t(`pro.trial.admin.events.${e.kind}`)}
                            </i>
                          ))}
                        </span>
                      </span>
                      <span>
                        <TrialActions designerId={r.designerId} status={live ? "active" : r.status} canManage={canManage} />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="ap-g3">
            <section className="ap-c">
              <div className="ap-h">
                <div>
                  <h2>{t("pro.admin.best")}</h2>
                  <p>{t("pro.admin.bestLead")}</p>
                </div>
              </div>
              {o.best.length === 0 && <p className="ap-hint">{t("pro.admin.noBest")}</p>}
              {o.best.map((m, i) => (
                <div key={m.designerId} className="ap-best">
                  <span className="ap-rk">{n(i + 1)}</span>
                  <span className="ap-av">{m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : (m.name[0] ?? "?").toUpperCase()}</span>
                  <span className="ap-nm">
                    <b>{m.name}</b>
                    <em>{t("pro.admin.bestLine", { a: n(m.winsBefore), b: n(m.winsAfter) })}</em>
                  </span>
                  <span className="ap-big">
                    +{n(m.rateChange)}%<em>{t("pro.admin.winRate")}</em>
                  </span>
                </div>
              ))}
              <div className="ap-mini">
                <div>
                  <span>{t("pro.admin.avgBefore")}</span>
                  <b>{o.avgBefore === null ? "—" : pct(o.avgBefore)}</b>
                </div>
                <div>
                  <span>{t("pro.admin.avgAfter")}</span>
                  <b className="g">{o.avgAfter3m === null ? "—" : pct(o.avgAfter3m)}</b>
                </div>
              </div>
            </section>
            <section className="ap-c">
              <div className="ap-h">
                <div>
                  <h2>{t("pro.admin.why")}</h2>
                  <p>{t("pro.admin.whyLead")}</p>
                </div>
              </div>
              {o.reasons.length === 0 && <p className="ap-hint">{t("pro.admin.noWhy")}</p>}
              {o.reasons.map((r) => (
                <div key={r.reason} className="ap-sb">
                  <div>
                    <span>{t(`pro.settings.reasons.${r.reason}` as MessageKey)}</span>
                    <b>{pct(share(r.count, reasonsTotal))}</b>
                  </div>
                  <span className="ap-bar red">
                    <s style={{ width: `${share(r.count, reasonsTotal)}%` }} />
                  </span>
                </div>
              ))}
              <div className="ap-mini">
                <div>
                  <span>{t("pro.admin.cancelDays")}</span>
                  <b>{o.cancelDays ? t("pro.admin.dayRange", { range: o.cancelDays }) : "—"}</b>
                </div>
                <div>
                  <span>{t("pro.admin.avgTime")}</span>
                  <b>{o.avgMonths === null ? "—" : t("pro.admin.months", { n: n(o.avgMonths) })}</b>
                </div>
              </div>
            </section>
            <section className="ap-c">
              <div className="ap-h">
                <div>
                  <h2>{t("pro.admin.log")}</h2>
                  <p>{t("pro.admin.logLead")}</p>
                </div>
                <a href="/admin/pro/activity" className="ap-btn ghost sm">
                  {t("pro.admin.export")}
                </a>
              </div>
              {o.activity.length === 0 && <p className="ap-hint">{t("pro.admin.noLog")}</p>}
              {o.activity.map((a) => (
                <div key={a.id} className="ap-lg">
                  <i />
                  <div>
                    <b>{a.actor ?? t("pro.admin.system")}</b> {describe(a)}
                    <em>{timeAgo(new Date(a.at), now, locale)}</em>
                  </div>
                </div>
              ))}
            </section>
          </div>
          <p className="ap-hint" style={{ textAlign: "center" }}>
            {t("pro.admin.realNote")}
          </p>
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAction } from "@/components/admin/admin-action";
import { AdminIcon, type AdminIconName } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { AdmCard, AdmEmpty, Pill, type PillTone } from "@/components/admin/ui";
import { adminUser, requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { giveStrike, removeStrike, setTestAccount, setUserStatus } from "@/lib/admin/user-actions";
import { deleteUser, eraseUserNow, restoreUserFromTrash } from "@/lib/admin/trash-actions";
import { impersonateUser, sendResetEmail, setUserPassword, signOutEverywhere, signOutOneDevice } from "@/lib/admin/security-actions";
import { deviceText, placeText, SessionStatus, whenText } from "@/components/admin/session-bits";
import { userSessions } from "@/lib/auth/sessions";
import { getSettings } from "@/lib/settings";
import { getUser } from "@/lib/admin/users";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { formatMobile } from "@/lib/phone";
import { answerLines, designerOnboardingAnswers, getOnboarding } from "@/lib/onboarding/store";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.users.title"), robots: { index: false } };
}

const STATUS_DOT: Record<string, string> = { active: "bg-adm-pay", suspended: "bg-adm-warn", banned: "bg-adm-bad", deleted: "bg-adm-bad" };
const TABS = ["activity", "work", "withdrawals", "strikes"] as const;
type Tab = (typeof TABS)[number];
const ENTRY_TONE: Record<string, PillTone> = { winner: "gold", active: "good", removed: "bad" };

// A-05 User profile (BLUEPRINT §13; design/admin/user-profile.html, owner 2026-10-10): who they are, their work and
// money, strikes, and the admin actions.
export default async function AdminUserPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  await requirePermission("users.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [{ t, locale }, u, me, sessions] = await Promise.all([getI18n(), getUser(id), adminUser(), userSessions(id, 20)]);
  if (!u) notFound();
  const self = me?.id === u.id;
  const { "trash.keep_days": keepDays, "security.impersonate_minutes": impersonateMinutes } = await getSettings(["trash.keep_days", "security.impersonate_minutes"]);
  const now = new Date();
  const openSessions = sessions.filter((x) => !x.endedAt);
  // A designer's answers at sign-up to the owner's own questions (Admin › Onboarding, owner 2026-10-14).
  const signupAnswers = u.role === "designer" ? answerLines(await getOnboarding("designer"), await designerOnboardingAnswers(u.id), locale) : [];
  // Logins, password and "Log in as" (owner, 2026-10-14): clients and designers only.
  const person = u.role !== "admin" && !u.trash;
  const canManage = Boolean(me && hasPermission(me, "users.manage"));
  const d = u.designer;
  const tabs = TABS.filter((x) => x !== "withdrawals" || d);
  const tab: Tab = tabs.find((x) => x === sp.tab) ?? "activity";
  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const when = (x: Date) => x.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" });
  const rated = d ? Object.values(d.ratings).reduce((a, n) => a + n, 0) : 0;
  const avg = d && rated ? Object.entries(d.ratings).reduce((a, [star, n]) => a + Number(star) * n, 0) / rated : null;
  const ratingMax = d ? Math.max(1, ...Object.values(d.ratings)) : 1;
  const canMessage = u.role !== "admin" && me && hasPermission(me, "messages.manage");
  const canChat = u.role !== "admin" && me && hasPermission(me, "support.view");
  const publicHref = u.username && u.role !== "admin" ? `/${u.role === "designer" ? "d" : "c"}/${u.username}` : null;

  // The Activity timeline: what this person did, newest first.
  const timeline: { at: Date; icon: AdminIconName; title: string; line?: string; href?: string }[] = [
    { at: u.createdAt, icon: "joined" as const, title: t("admin.users.tl.joined") },
    ...(d?.agreedAt ? [{ at: d.agreedAt, icon: "agreements" as const, title: t("admin.users.tl.agreed") }] : []),
    ...u.entries.map((e) => ({
      at: e.createdAt,
      icon: (e.status === "winner" ? "monthly" : "designs") as AdminIconName,
      title: e.status === "winner" ? t("admin.users.tl.won", { brand: e.brand }) : t("admin.users.tl.sent", { brand: e.brand }),
      line: t("admin.users.tl.entry", { n: num(e.number), status: t(`admin.entries.statuses.${e.status}` as MessageKey) }),
      href: `/admin/contests/${e.slug}`,
    })),
    ...u.contests.map((c) => ({ at: c.createdAt, icon: "contests" as const, title: t("admin.users.tl.started", { brand: c.brand }), line: t(`status.${c.status}` as MessageKey), href: `/admin/contests/${c.slug}` })),
    ...(d?.withdrawals ?? []).map((w) => ({ at: w.createdAt, icon: "withdrawals" as const, title: t("admin.users.tl.withdrawal", { amount: taka(w.amount) }), line: t(`admin.activity.lines.withdrawal.${w.status}` as MessageKey) })),
    ...u.strikeHistory.map((s) => ({ at: s.createdAt, icon: "reports" as const, title: t("admin.users.tl.strike"), line: s.reason })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const fact = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <strong className="min-w-0 truncate text-right">{value}</strong>
    </div>
  );
  const rowLink = "flex flex-wrap items-center justify-between gap-3 border-t border-adm-line-soft py-3 first:border-t-0";

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.users.profile")} crumbs={[{ href: "/admin/users", label: t("admin.users.title") }]} />
      {/* In the Trash (owner, 2026-10-14): Restore, or Erase now (Super admin). */}
      {u.trash && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-danger/10 px-4 py-3 text-[15px] text-danger">
          <span>
            <b>{t("admin.trash.inTrash", { date: formatDate(u.trash.at, locale, "long"), erase: formatDate(new Date(u.trash.at.getTime() + keepDays * 86_400_000), locale, "long") })}</b>
            {u.trash.reason && <span className="block">{t("admin.trash.reason", { reason: u.trash.reason })}</span>}
          </span>
          <span className="flex flex-wrap gap-2">
            {canManage && <AdminAction label={t("admin.trash.restore")} body={t("admin.trash.restoreBody")} tone="primary" fields={[]} run={restoreUserFromTrash.bind(null, u.id)} done={t("admin.trash.restored")} />}
            {me?.isSuperAdmin && <AdminAction label={t("admin.trash.eraseNow")} body={t("admin.trash.eraseBody")} tone="danger" fields={[]} run={eraseUserNow.bind(null, u.id)} done={t("admin.trash.erased")} />}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        {/* Left: who they are */}
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 xl:max-w-[400px]">
          <AdmCard className="flex flex-col gap-4 p-4">
            <div className="relative h-28 overflow-hidden rounded-[12px] bg-primary">
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[13.5px] font-bold text-ink">
                <span className={cx("size-2 rounded-full", STATUS_DOT[u.status])} />
                {t(`admin.users.statuses.${u.status}`)}
              </span>
            </div>
            <span className="lc-d relative z-10 -mt-[52px] ml-2 flex size-[84px] items-center justify-center rounded-[22px] border-4 border-white bg-tint text-[32px] font-semibold text-primary">{u.name.trim().slice(0, 1).toUpperCase()}</span>
            <div className="flex flex-col gap-0.5 px-2">
              <strong className="lc-d text-[23px] font-semibold tracking-[-0.025em]">{u.name}</strong>
              <span className="text-[15.5px] text-muted">
                {u.username && `@${u.username} · `}
                {t(`admin.users.roles.${u.role}`)}
              </span>
              {u.status === "suspended" && u.suspendedUntil && <span className="mt-1 text-sm font-semibold text-adm-warn">{t("admin.users.suspendedUntil", { date: when(u.suspendedUntil) })}</span>}
              {u.isTest && (
                <span className="mt-1.5">
                  <Pill tone="sample">{t("admin.users.testAccount")}</Pill>
                </span>
              )}
            </div>
            {d && (
              <div className="grid grid-cols-3 gap-2 px-2">
                {[
                  { n: num(d.entries), label: t("admin.users.stats.entries") },
                  { n: num(d.wins), label: t("admin.users.stats.wins") },
                  { n: avg === null ? "—" : num(Math.round(avg * 10) / 10), label: t("admin.users.stats.stars") },
                ].map((x) => (
                  <div key={x.label} className="flex flex-col">
                    <span className="lc-d text-2xl font-semibold tracking-[-0.02em]">{x.n}</span>
                    <span className="text-sm text-muted">{x.label}</span>
                  </div>
                ))}
              </div>
            )}
            {u.role === "client" && (
              <div className="grid grid-cols-2 gap-2 px-2">
                <div className="flex flex-col">
                  <span className="lc-d text-2xl font-semibold tracking-[-0.02em]">{num(u.contests.length)}</span>
                  <span className="text-sm text-muted">{t("admin.users.contests")}</span>
                </div>
                {u.businessName && (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate pt-1 text-base font-bold">{u.businessName}</span>
                    <span className="text-sm text-muted">{t("admin.users.business")}</span>
                  </div>
                )}
              </div>
            )}
            {(canMessage || canChat || publicHref) && (
              <div className="flex flex-wrap gap-2 px-2 pb-2">
                {canMessage && (
                  <Link href={`/admin/messages?to=${u.id}`} className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] bg-primary px-4 text-[15px] font-bold text-white hover:bg-adm-deep">
                    <AdminIcon name="messages" size={16} />
                    {t("admin.activity.message")}
                  </Link>
                )}
                {canChat && (
                  <Link href={`/admin/support?user=${u.id}`} className="inline-flex h-[46px] flex-1 items-center justify-center whitespace-nowrap rounded-[12px] border border-adm-line px-4 text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
                    {t("admin.users.openChat")}
                  </Link>
                )}
                {publicHref && (
                  <a href={publicHref} target="_blank" rel="noopener" className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] border border-adm-line px-4 text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
                    {t("admin.users.publicProfile")}
                    <AdminIcon name="external" size={15} />
                  </a>
                )}
              </div>
            )}
          </AdmCard>

          <AdmCard className="flex flex-col gap-[18px] p-[22px] text-[15.5px]">
            <div className="flex flex-col gap-2.5">
              <h2 className="m-0 text-[17px] font-semibold">{t("admin.users.general")}</h2>
              {fact(t("admin.users.joined"), formatDate(u.createdAt, locale, "long"))}
              {d &&
                fact(
                  t("admin.users.payout"),
                  d.payoutType
                    ? `${t(`designerSignup.payout.${d.payoutType}` as MessageKey)}${d.payoutType === "bkash" ? ` · ${d.bkashKind ? t(`wallet.form.${d.bkashKind}`) : t("admin.users.bkashKindUnknown")}` : ""}`
                    : "—",
                )}
              {d && fact(t("footer.designerRules"), d.agreedAt ? <span className="text-adm-good">{t("admin.users.agreed")}</span> : <span className="text-adm-warn">{t("admin.users.notAgreed")}</span>)}
              {fact(t("admin.users.strikes"), num(u.strikes))}
              {u.flagWarnings > 0 && fact(t("admin.users.warningsLabel"), num(u.flagWarnings))}
            </div>
            <div className="flex flex-col gap-2.5 border-t border-adm-line-soft pt-[18px]">
              <h2 className="m-0 text-[17px] font-semibold">{t("admin.users.contact")}</h2>
              {fact(
                t("admin.users.phone"),
                <a href={`tel:${u.mobile}`} className="font-mono hover:text-primary">
                  {formatMobile(u.mobile)}
                </a>,
              )}
              {fact(t("admin.users.email"), u.email ?? "—")}
              {fact(t("admin.users.whatsapp"), u.whatsapp ? <span className="text-adm-good">{t("admin.users.onWhatsapp")}</span> : <span className="text-muted">{t("admin.users.notOnWhatsapp")}</span>)}
            </div>
            {!self && !u.trash && (
              <div className="flex flex-col gap-2.5 border-t border-adm-line-soft pt-[18px]">
                <h2 className="m-0 text-[17px] font-semibold">{t("admin.users.actions")}</h2>
                <div className="flex flex-wrap gap-2">
                  {/* Owner, 2026-10-12: a suspension is 48 hours and counts toward the ban (3 within 30 days). */}
                  {u.status === "active" && (
                    <AdminAction label={t("admin.users.suspend")} body={t(u.strikes >= 2 ? "admin.users.x.actions.suspendBans" : "admin.users.strikeBody")} tone="secondary" run={giveStrike.bind(null, u.id)} done={t("admin.users.strikeGiven")} />
                  )}
                  {u.role !== "admin" && canManage && <AdminAction label={t("admin.trash.deleteUser")} body={t("admin.trash.deleteUserBody", { days: String(keepDays) })} tone="danger" run={deleteUser.bind(null, u.id)} />}
                  {u.status !== "banned" && <AdminAction label={t("admin.users.ban")} body={t("admin.users.banBody")} tone="danger" run={setUserStatus.bind(null, u.id, "banned")} />}
                  {u.status !== "active" && <AdminAction label={t(u.status === "suspended" ? "admin.users.x.actions.unsuspend" : "admin.users.reactivate")} tone="primary" run={setUserStatus.bind(null, u.id, "active")} />}
                  {/* Owner, 2026-10-11: test accounts never take part in the monthly race */}
                  {u.role !== "admin" && (
                    <AdminAction
                      label={t(u.isTest ? "admin.users.unmarkTest" : "admin.users.markTest")}
                      body={t(u.isTest ? "admin.users.unmarkTestBody" : "admin.users.markTestBody")}
                      tone="ghost"
                      fields={[]}
                      run={setTestAccount.bind(null, u.id, !u.isTest)}
                      done={t("admin.saved")}
                    />
                  )}
                </div>
                <p className="m-0 text-[13.5px] text-muted">{t("admin.users.ladder")}</p>
              </div>
            )}
          </AdmCard>

          {signupAnswers.length > 0 && (
            <AdmCard className="flex flex-col gap-2.5 p-[22px] text-[15px]">
              <h2 className="m-0 text-[17px] font-semibold">{t("admin.onboarding.answers")}</h2>
              <dl className="m-0 flex flex-col gap-2.5">
                {signupAnswers.map((x) => (
                  <div key={x.label}>
                    <dt className="text-[14px] text-muted">{x.label}</dt>
                    <dd className="m-0 whitespace-pre-line font-semibold">{x.answer}</dd>
                  </div>
                ))}
              </dl>
            </AdmCard>
          )}

          {/* Devices, password and "Log in as" (owner, 2026-10-14) */}
          {person && (
            <AdmCard className="flex flex-col gap-[18px] p-[22px] text-[15px]">
              <div className="flex flex-col gap-2">
                <h2 className="m-0 text-[17px] font-semibold">{t("admin.security.devicesTitle")}</h2>
                {sessions.length === 0 ? (
                  <p className="m-0 text-sm text-muted">{t("admin.security.noDevices")}</p>
                ) : (
                  <ul className="m-0 list-none divide-y divide-adm-line-soft p-0">
                    {sessions.slice(0, 8).map((x) => (
                      <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                        <span className="min-w-0 flex-[1_1_180px]">
                          <span className="block font-semibold text-ink">{deviceText(x, t)}</span>
                          <span className="block text-muted">{[placeText(x, locale), x.ip].filter(Boolean).join(" · ") || t("admin.security.noPlace")}</span>
                          <span className="block text-muted">{t("admin.security.loggedIn", { when: whenText(x.createdAt, locale) })}</span>
                          {x.impersonatedBy && <span className="block text-[13px] text-adm-sample">{t("admin.security.openedBy", { name: x.impersonatedBy })}</span>}
                          <SessionStatus r={x} t={t} locale={locale} now={now} />
                        </span>
                        {!x.endedAt && canManage && <AdminAction label={t("admin.security.signOutOne")} tone="ghost" fields={[]} run={signOutOneDevice.bind(null, u.id, x.id)} done={t("admin.security.signedOut")} />}
                      </li>
                    ))}
                  </ul>
                )}
                {canManage && openSessions.length > 1 && (
                  <div>
                    <AdminAction label={t("admin.security.signOutAll")} body={t("admin.security.signOutAllBody")} tone="secondary" fields={[]} run={signOutEverywhere.bind(null, u.id)} done={t("admin.security.signedOut")} />
                  </div>
                )}
              </div>
              {canManage && (
                <div className="flex flex-col gap-2 border-t border-adm-line-soft pt-[18px]">
                  <h2 className="m-0 text-[17px] font-semibold">{t("admin.security.passwordTitle")}</h2>
                  <p className="m-0 text-[13.5px] text-muted">{t("admin.security.passwordNote")}</p>
                  <div className="flex flex-wrap gap-2">
                    <AdminAction label={t("admin.security.sendReset")} body={t("admin.security.sendResetBody", { email: u.email ?? "—" })} tone="secondary" fields={[]} run={sendResetEmail.bind(null, u.id)} done={t("admin.security.resetSent")} />
                    <AdminAction
                      label={t("admin.security.setPassword")}
                      body={t("admin.security.setPasswordBody")}
                      tone="secondary"
                      fields={[
                        { name: "password", kind: "text", label: t("admin.security.newPassword"), hint: t("admin.security.newPasswordHint") },
                        { name: "reason", kind: "reason" },
                      ]}
                      run={setUserPassword.bind(null, u.id)}
                      done={t("admin.security.passwordSet")}
                    />
                  </div>
                </div>
              )}
              {me?.isSuperAdmin && (
                <div className="flex flex-col gap-2 border-t border-adm-line-soft pt-[18px]">
                  <AdminAction label={t("admin.security.impersonate")} body={t("admin.security.impersonateBody", { minutes: String(impersonateMinutes) })} tone="primary" fields={[]} run={impersonateUser.bind(null, u.id)} />
                </div>
              )}
            </AdmCard>
          )}
        </div>

        {/* Right: their work and money */}
        <div className="flex min-w-0 flex-[3_1_480px] flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            <AdmCard className="flex flex-col gap-2.5 p-[22px]">
              <h2 className="m-0 text-[17px] font-semibold">{t("admin.users.bio")}</h2>
              <p className="m-0 whitespace-pre-line text-[15.5px] text-muted">{u.bio || t("admin.users.noBio")}</p>
            </AdmCard>
            {d && (
              <AdmCard className="flex flex-col gap-3 p-[22px]">
                <h2 className="m-0 text-[17px] font-semibold">{t("nav.wallet")}</h2>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] text-muted">{t("admin.users.walletBalance")}</span>
                  <span className="lc-d text-[26px] font-semibold tracking-[-0.03em] text-primary">{u.balance === null ? "—" : taka(u.balance)}</span>
                </div>
                <div className="flex justify-between gap-3 text-[15.5px]">
                  <span className="text-muted">{t("admin.users.waiting")}</span>
                  <strong>{taka(d.waiting)}</strong>
                </div>
                <div className="flex justify-between gap-3 text-[15.5px]">
                  <span className="text-muted">{t("admin.users.paidOut")}</span>
                  <strong>{taka(d.paidOut)}</strong>
                </div>
              </AdmCard>
            )}
            {d && (
              <AdmCard className="flex flex-col gap-3 p-[22px]">
                <h2 className="m-0 text-[17px] font-semibold">{t("admin.users.ratings")}</h2>
                {rated === 0 ? (
                  <p className="m-0 text-[15px] text-muted">{t("admin.users.noRatings")}</p>
                ) : (
                  ([5, 4, 3, 2, 1] as const)
                    .filter((star) => d.ratings[star] > 0)
                    .map((star) => (
                      <div key={star} className="flex items-center gap-2.5 text-[14.5px]">
                        <span className="w-14 font-semibold">{t("admin.users.stars", { n: num(star) })}</span>
                        <span className="h-3 flex-1 overflow-hidden rounded-full bg-[#f0f1f4]">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${(d.ratings[star] / ratingMax) * 100}%` }} />
                        </span>
                        <strong className="w-6 text-right tabular-nums">{num(d.ratings[star])}</strong>
                      </div>
                    ))
                )}
              </AdmCard>
            )}
          </div>

          <AdmCard className="overflow-hidden">
            <nav aria-label={t("admin.users.sections")} className="flex flex-wrap gap-1.5 border-b border-adm-line-soft px-4 py-4 sm:px-5">
              {tabs.map((x) => (
                <Link
                  key={x}
                  href={x === "activity" ? `/admin/users/${u.id}` : `/admin/users/${u.id}?tab=${x}`}
                  scroll={false}
                  aria-current={x === tab ? "page" : undefined}
                  className={cx("inline-flex h-[42px] items-center rounded-[10px] px-[18px] text-[15.5px] font-bold", x === tab ? "bg-primary text-white" : "text-adm-strong hover:bg-adm-bg")}
                >
                  {x === "work" ? (u.role === "designer" ? t("admin.users.designs") : t("admin.users.contests")) : t(`admin.users.tabs.${x}`)}
                </Link>
              ))}
            </nav>

            <div className="p-4 sm:p-5">
              {tab === "activity" && (
                <ol className="m-0 flex list-none flex-col p-0">
                  {timeline.slice(0, 60).map((x, i) => {
                    const body = (
                      <>
                        <span className="w-[86px] shrink-0 pt-1 text-sm font-semibold tabular-nums text-muted">{when(x.at)}</span>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f0f1f4] text-adm-strong">
                          <AdminIcon name={x.icon} size={16} />
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <strong className="text-[15.5px]">{x.title}</strong>
                          {x.line && <span className="text-[14.5px] text-muted">{x.line}</span>}
                        </span>
                      </>
                    );
                    return (
                      <li key={i} className="border-t border-adm-line-soft first:border-t-0">
                        {x.href ? (
                          <Link href={x.href} className="flex gap-3 py-3.5 hover:bg-[#fafafb]">
                            {body}
                          </Link>
                        ) : (
                          <div className="flex gap-3 py-3.5">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}

              {tab === "work" &&
                (u.role === "designer" ? (
                  u.entries.length === 0 ? (
                    <AdmEmpty>{t("admin.users.none")}</AdmEmpty>
                  ) : (
                    <ul className="m-0 flex list-none flex-col p-0">
                      {u.entries.map((e, i) => (
                        <li key={i} className={rowLink}>
                          <Link href={`/admin/contests/${e.slug}`} className="font-bold hover:text-primary">
                            {t("admin.activity.design", { brand: e.brand, n: num(e.number) })}
                          </Link>
                          <span className="flex items-center gap-2 text-sm text-muted">
                            <Pill tone={ENTRY_TONE[e.status] ?? "neutral"}>{t(`admin.entries.statuses.${e.status}` as MessageKey)}</Pill>
                            {formatDate(e.createdAt, locale, "short")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : u.contests.length === 0 ? (
                  <AdmEmpty>{t("admin.users.none")}</AdmEmpty>
                ) : (
                  <ul className="m-0 flex list-none flex-col p-0">
                    {u.contests.map((c) => (
                      <li key={c.slug} className={rowLink}>
                        <Link href={`/admin/contests/${c.slug}`} className="font-bold hover:text-primary">
                          {c.brand}
                        </Link>
                        <span className="flex items-center gap-2 text-sm text-muted">
                          <Pill>{t(`status.${c.status}` as MessageKey)}</Pill>
                          {formatDate(c.createdAt, locale, "short")}
                        </span>
                      </li>
                    ))}
                  </ul>
                ))}

              {tab === "withdrawals" &&
                d &&
                (d.withdrawals.length === 0 ? (
                  <AdmEmpty>{t("admin.users.noWithdrawals")}</AdmEmpty>
                ) : (
                  <ul className="m-0 flex list-none flex-col p-0">
                    {d.withdrawals.map((w, i) => (
                      <li key={i} className={rowLink}>
                        <span className="flex flex-col">
                          <strong className="lc-d text-lg font-semibold">{taka(w.amount)}</strong>
                          <span className="text-sm text-muted">
                            {t(`designerSignup.payout.${w.method}` as MessageKey)} · {when(w.createdAt)}
                          </span>
                        </span>
                        <Pill tone={w.status === "paid" ? "good" : w.status === "rejected" ? "bad" : "warn"}>{t(`admin.users.withdrawalStatus.${w.status}` as MessageKey)}</Pill>
                      </li>
                    ))}
                  </ul>
                ))}

              {tab === "strikes" && (
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-sm text-muted">{t("admin.users.ladder")}</p>
                  {u.strikeHistory.length === 0 ? (
                    <AdmEmpty>{t("admin.users.noStrikes")}</AdmEmpty>
                  ) : (
                    <ul className="m-0 flex list-none flex-col p-0">
                      {u.strikeHistory.map((s) => (
                        <li key={s.id} className={cx(rowLink, "items-start")}>
                          <div className={cx("min-w-0", s.removedAt && "opacity-60")}>
                            <p className="m-0 font-bold">{s.reason}</p>
                            <p className="m-0 text-sm text-muted">
                              {t(`admin.users.issuer.${s.issuerRole}` as MessageKey)}
                              {s.issuer && <> · {s.issuer}</>} · {when(s.createdAt)}
                              {s.contest && (
                                <>
                                  {" · "}
                                  <Link href={`/admin/contests/${s.contest.slug}`} className="text-primary hover:underline">
                                    {s.contest.brand}
                                  </Link>
                                </>
                              )}
                            </p>
                            {s.removedAt && <p className="m-0 text-sm font-semibold text-muted">{t("admin.users.removedOn", { date: when(s.removedAt) })}</p>}
                          </div>
                          {!s.removedAt && <AdminAction label={t("admin.users.removeStrike")} tone="ghost" run={removeStrike.bind(null, s.id)} />}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </AdmCard>
        </div>
      </div>
    </div>
  );
}

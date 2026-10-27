import type { Metadata } from "next";
import { SeenNow } from "@/components/admin/admin-nav";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { AdminIcon } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { DetailsWhileLoading, LeadSelection } from "@/components/admin/unpaid/actions";
import { LeadDetails } from "@/components/admin/unpaid/lead-details";
import { LeadList, type Fmt } from "@/components/admin/unpaid/lead-list";
import { LiveNow } from "@/components/admin/unpaid/live";
import { AutoReminders, InstantAlerts } from "@/components/admin/unpaid/alerts";
import { FollowUpPlan, StuckFunnel, UnpaidStats, type PlanItem, type StatCard } from "@/components/admin/unpaid/overview";
import { sectionVisit } from "@/lib/admin/badges";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { cachedStuckFunnel, leadHistory, unpaidBoard, type Lead } from "@/lib/admin/unpaid-board";
import { dhakaMidnight, inTab, isContactSearch, isOpen, matchesFilters, PAID, parseUnpaidQuery, sameDhakaDay, shownStatus, sortLeads, TABS, unpaidHref, type Tab } from "@/lib/admin/unpaid-rules";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { formatMobile, maskBdMobile } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { firstName } from "@/lib/wizard-live-rules";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.unpaid.title"), robots: { index: false } };
}

// A-22 Unpaid contests, rebuilt as the follow-up page (owner, 2026-10-25; Design/unpaid-contests): everyone who started
// a contest but didn't pay (drafts and guests who only gave a number), where they got stuck, the follow-up list with a
// lead's details, and the plan. Phone and email only for Unpaid · Manage, worked out here on the server.
export default async function AdminUnpaidPage({ searchParams }: PageProps<"/admin/unpaid">) {
  const me = await requirePermission("unpaid.view");
  const canManage = hasPermission(me, "unpaid.manage");
  const q = parseUnpaidQuery(await searchParams);
  const now = new Date();
  const [{ t, locale }, board, funnel, visit] = await Promise.all([
    getI18n(),
    unpaidBoard(now, q.sel?.startsWith("g:") ? q.sel.slice(2) : undefined),
    cachedStuckFunnel(q.range),
    // Contests and leads that came in since this admin last opened Unpaid get a "New" tag (owner, 2026-10-23).
    sectionVisit(me, "unpaid"),
  ]);
  // Phase 3 (owner, 2026-10-26): the team's Instant alerts and the Automatic reminders to clients, one setting each.
  const settings = await getSettings(["notify.unpaid_alerts", "notify.followup_due_minutes", "notify.lead_alert_minutes", "notify.unpaid_reminders", "notify.unpaid_reminder_first_hours", "notify.unpaid_reminder_last_hours", "security.resume_link_days"]);
  const alerts = settings["notify.unpaid_alerts"];
  const alertsOn = Object.values(alerts.events).some(Boolean) && (alerts.send.popup || alerts.send.push || alerts.send.email);
  const remindDefault = [...(alerts.send.popup || alerts.send.push ? ["alert" as const] : []), ...(alerts.send.email ? ["email" as const] : [])];
  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const time = (d: Date) => d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" });
  const day = (d: Date) => d.toLocaleDateString(tag, { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
  const when = (d: Date) => (sameDhakaDay(d, now) ? `${t("admin.analytics.today")}, ${time(d)}` : `${day(d)}, ${time(d)}`);
  const stepName = (n: number) => t(`admin.dashboard.steps.s${n}` as MessageKey);
  const fmt: Fmt = { t, num, taka, when, day, stepName };
  const status = (l: Lead) => shownStatus(l, now);

  // Search: brand, name and LC id in the address. A phone or email search is looked up by a server action (Unpaid ·
  // Manage) and comes back as `only`, the leads' keys, so no number is ever in the address.
  const needle = isContactSearch(q.q) ? "" : q.q.toLowerCase();
  const found = (l: Lead) => {
    if (q.only && !q.only.includes(l.key) && !(l.kind === "guest" && q.only.some((k) => k.startsWith("g:") && l.visitIds.includes(k.slice(2))))) return false;
    if (!needle) return true;
    if (`${l.brand} ${l.clientName ?? ""}`.toLowerCase().includes(needle)) return true;
    return Boolean(l.number && /^(lc-?)?\d+$/.test(needle) && String(l.number) === needle.replace(/^lc-?0*/, ""));
  };
  // The tab counts follow the search and filters, not the tab.
  const pool = board.leads.filter(found).filter((l) => matchesFilters(l, q, now, me.id));
  const counts = Object.fromEntries(TABS.map((tab) => [tab, pool.filter((l) => inTab(l, tab, now)).length])) as Record<Tab, number>;
  const rows = sortLeads(
    pool.filter((l) => inTab(l, q.tab, now)),
    q.sort,
  );
  // A link to someone (an alert, a shared view) opens that person or says they are gone; never someone else.
  const selected = q.sel ? (board.leads.find((l) => l.key === q.sel || (q.sel!.startsWith("g:") && l.visitIds.includes(q.sel!.slice(2)))) ?? null) : (rows[0] ?? null);
  const contact = selected ? board.contacts.get(selected.key) : undefined;
  const history = selected ? await leadHistory(selected, contact) : [];
  const masked = canManage && contact?.mobile ? (contact.mobile.startsWith("+880") ? maskBdMobile(contact.mobile) : `${formatMobile(contact.mobile).slice(0, 4)} •••• ${contact.mobile.slice(-3)}`) : null;
  // The client's resume link (owner, 2026-10-26): made and logged on the server when it is copied.
  const resumeDays = selected?.kind === "contest" && selected.contestId && selected.stage < PAID ? settings["security.resume_link_days"] : null;

  // The six numbers (handoff §1), each a way into the list.
  const open = board.leads.filter(isOpen);
  const todayStart = dhakaMidnight(now);
  const local = new Date(now.getTime() + 6 * 3_600_000);
  const monthStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 6 * 3_600_000);
  const won = board.leads.filter((l) => l.wonBack && l.wonBack.at >= monthStart);
  const left = open.filter((l) => l.nextAt && sameDhakaDay(l.nextAt, now)).length;
  const cards: StatCard[] = [
    { key: "unpaid", label: t("admin.unpaid.fu.stats.unpaid"), value: num(open.length), hint: t("admin.unpaid.fu.stats.unpaidHint", { n: num(open.filter((l) => l.createdAt >= todayStart).length) }), href: unpaidHref(q, { tab: "all", sel: null }, "#ulist"), tone: "plain" },
    { key: "money", label: t("admin.unpaid.fu.stats.money"), value: taka(open.reduce((a, l) => a + (l.amount ?? 0), 0)), hint: t("admin.unpaid.fu.stats.moneyHint"), href: unpaidHref(q, { tab: "all", sort: "money", sel: null }, "#ulist"), tone: "money" },
    { key: "today", label: t("admin.unpaid.fu.stats.today"), value: num(left + board.doneToday.length), hint: t("admin.unpaid.fu.stats.todayHint", { done: num(board.doneToday.length), left: num(left) }), href: unpaidHref(q, { tab: "today", sel: null }, "#ulist"), tone: "today" },
    { key: "overdue", label: t("admin.unpaid.fu.stats.overdue"), value: num(open.filter((l) => l.nextAt && l.nextAt < now).length), hint: t("admin.unpaid.fu.stats.overdueHint"), href: unpaidHref(q, { tab: "overdue", sel: null }, "#ulist"), tone: "overdue" },
    { key: "won", label: t("admin.unpaid.fu.stats.won"), value: `${num(won.length)} · ${taka(won.reduce((a, l) => a + (l.wonBack?.amount ?? 0), 0))}`, hint: t("admin.unpaid.fu.stats.wonHint"), href: unpaidHref(q, { tab: "won", sel: null }, "#ulist"), tone: "won" },
    { key: "fake", label: t("admin.unpaid.fu.stats.fake"), value: num(board.leads.filter((l) => l.status === "closed" && l.closedReason === "fake").length), hint: t("admin.unpaid.fu.stats.fakeHint"), href: unpaidHref(q, { tab: "closed", sel: null }, "#ulist"), tone: "plain" },
  ];

  // The Follow-up plan (handoff §8).
  const tomorrow = dhakaMidnight(now, 1);
  const after = dhakaMidnight(now, 2);
  const plan: PlanItem[] = [
    ...open
      .filter((l) => l.nextAt)
      .map((l) => ({ key: l.key, brand: l.brand || l.clientName || t("admin.unpaid.fu.list.guest"), at: l.nextAt!, type: l.nextType ?? "call", done: false, group: (l.nextAt! < todayStart ? "overdue" : l.nextAt! < tomorrow ? "today" : l.nextAt! < after ? "tomorrow" : "later") as PlanItem["group"] })),
    ...board.doneToday.map((d) => ({ key: d.key, brand: d.brand, at: d.at, type: d.type === "system" ? "call" : d.type, done: true, group: "today" as const })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const planLabel = (i: PlanItem) => (i.group === "overdue" ? day(i.at) : i.group === "later" ? `${day(i.at)} ${time(i.at)}` : time(i.at));

  return (
    <div className="flex flex-col gap-5">
      {visit.at && <SeenNow section="unpaid" at={visit.at} />}
      {/* "Live": the data comes back every 20 seconds while the page is open (handoff §1; real data only). */}
      {/* Every minute (owner, 2026-10-27: every 20 s was most of the database traffic); live cards keep their own beat. */}
      <AutoRefresh seconds={60} />
      <AdminHead
        title={t("admin.unpaid.title")}
        lead={t("admin.unpaid.fu.lead")}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#E4F5EC] px-3 py-1 text-[13px] font-bold text-[#14633C]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-[#2BB673] opacity-60 motion-safe:animate-ping" />
                <span className="relative size-2 rounded-full bg-[#2BB673]" />
              </span>
              {t("admin.unpaid.fu.live")}
            </span>
            {/* Instant alerts on or off (phase 3), a jump to their switches. */}
            <a href="#unot" className={alertsOn ? "inline-flex items-center gap-1.5 rounded-full bg-[#111216] px-3 py-1 text-[13px] font-bold text-white" : "inline-flex items-center gap-1.5 rounded-full bg-[#F1F1F5] px-3 py-1 text-[13px] font-bold text-[#6A6D78]"}>
              <AdminIcon name="bell" size={13} />
              {t(alertsOn ? "admin.unpaid.alerts.on" : "admin.unpaid.alerts.off")}
            </a>
          </span>
        }
      />
      {!board.ready && canManage && <p className="m-0 rounded-[12px] bg-adm-sample-bg px-4 py-3 text-[14px] font-semibold text-adm-sample">{t("admin.unpaid.fu.errors.notReady")}</p>}
      <UnpaidStats cards={cards} showLabel={t("admin.unpaid.fu.stats.show")} />
      {/* Who is on Start a contest this minute, Watch and Offer help (owner, 2026-10-25; phase 2): refreshes itself. */}
      <LiveNow canManage={canManage} me={firstName(me.name) || me.name} />
      <StuckFunnel funnel={funnel} q={q} t={t} num={num} stepName={stepName} empty={t("admin.dashboard.funnelEmpty")} />
      {/* Clicking a person shows it at once (row marked, details faded) while their details load (owner, 2026-10-25). */}
      <LeadSelection>
      <div className="grid items-start gap-4 min-[1251px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
        <LeadList rows={rows} counts={counts} q={q} fmt={fmt} me={me.id} owners={board.owners} canManage={canManage} since={visit.since} selectedKey={selected?.key ?? null} status={status} totalOpen={open.length} />
        <DetailsWhileLoading>
        <LeadDetails lead={selected} status={selected ? status(selected) : null} history={history} fmt={fmt} now={now} canManage={canManage} isSuperAdmin={me.isSuperAdmin} owners={board.owners} me={me.id} masked={masked} resumeDays={resumeDays} gone={Boolean(q.sel && !selected)} remindDefault={remindDefault} />
        </DetailsWhileLoading>
      </div>
      </LeadSelection>
      {/* The plan, Instant alerts and Automatic reminders side by side (Design/unpaid-contests, phase 3). */}
      <div className="grid items-start gap-4 min-[901px]:grid-cols-2 min-[1251px]:grid-cols-3">
        <div className="min-w-0 min-[901px]:max-[1250px]:col-span-2">
          <FollowUpPlan items={plan} q={q} t={t} label={planLabel} />
        </div>
        <InstantAlerts value={alerts} minutes={{ newUnpaid: settings["notify.lead_alert_minutes"], due: settings["notify.followup_due_minutes"] }} canManage={canManage} />
        <AutoReminders value={settings["notify.unpaid_reminders"]} hours={{ first: settings["notify.unpaid_reminder_first_hours"], last: settings["notify.unpaid_reminder_last_hours"] }} canManage={canManage} />
      </div>
      <p className="m-0 text-center text-[14px] text-muted">{t("admin.unpaid.fu.footer")}</p>
    </div>
  );
}

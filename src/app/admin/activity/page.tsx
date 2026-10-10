import type { Metadata } from "next";
import Link from "next/link";
import { AdminIcon, type AdminIconName } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { CustomRange, PeriodTabs } from "@/components/admin/period";
import { AdmCard, AdmEmpty, ADM_INPUT, IdChip, Pill } from "@/components/admin/ui";
import { activityFeed, type Activity, type ActivityKind } from "@/lib/admin/analytics";
import { requirePermission } from "@/lib/admin/core";
import { readPeriod, type PeriodKey } from "@/lib/admin/period";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.activity.title"), robots: { index: false } };
}

const KEYS: readonly PeriodKey[] = ["today", "3", "7", "30", "custom"];
const CATEGORIES = ["all", "designs", "signups", "contests", "money", "comments", "files"] as const;
type Category = (typeof CATEGORIES)[number];
const CATEGORY_OF: Record<ActivityKind, Exclude<Category, "all">> = {
  design_sent: "designs",
  signup_client: "signups",
  signup_designer: "signups",
  contest_started: "contests",
  contest_paid: "money",
  withdrawal: "money",
  comment: "comments",
  files_approved: "files",
};
const KIND_ICON: Record<ActivityKind, AdminIconName> = {
  signup_client: "joined",
  signup_designer: "joined",
  contest_started: "contests",
  contest_paid: "payments",
  design_sent: "designs",
  comment: "comment",
  files_approved: "check",
  withdrawal: "withdrawals",
};
const WHO = ["all", "client", "designer"] as const;
const PAGE = 80;
const MAX = 300;

/** A stable key for one item (the ?sel= of the details panel). */
const keyOf = (a: Activity) => `${a.kind}:${a.at.getTime()}:${a.person?.id ?? ""}`;
const dhakaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);

// A-21 Activity (BLUEPRINT §13.2 item 3; design/admin/activity.html, owner 2026-10-10): what people did, newest first.
export default async function AdminActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requirePermission("dashboard.view");
  const sp = await searchParams;
  const { range, from, to, period, effective } = readPeriod(sp, KEYS, "7");
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const category: Category = CATEGORIES.find((c) => c === sp.type) ?? "all";
  const who = WHO.find((w) => w === sp.who) ?? "all";
  const q = str(sp.q).trim().toLowerCase().slice(0, 60);
  const limit = Math.min(MAX, Math.max(PAGE, Math.floor(Number(str(sp.limit)) || PAGE)));
  const [{ t, locale }, all] = await Promise.all([getI18n(), activityFeed(limit, effective)]);
  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const time = (d: Date) => d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" });
  const longDate = (d: Date) => d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });
  const shortDate = (d: Date) => d.toLocaleDateString(tag, { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
  const now = new Date();
  const today = dhakaDay(now);
  const yesterday = dhakaDay(new Date(now.getTime() - 86_400_000));
  const dayTitle = (d: Date) => (dhakaDay(d) === today ? `${t("admin.analytics.today")} · ${longDate(d)}` : dhakaDay(d) === yesterday ? `${t("admin.activity.yesterday")} · ${longDate(d)}` : longDate(d));

  // Filters: who and search first (the tab counts follow them), then the type tab.
  const narrowed = all.filter((a) => (who === "all" || a.person?.role === who) && (!q || (a.person?.name ?? "").toLowerCase().includes(q) || a.label.toLowerCase().includes(q)));
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, c === "all" ? narrowed.length : narrowed.filter((a) => CATEGORY_OF[a.kind] === c).length])) as Record<Category, number>;
  const shown = category === "all" ? narrowed : narrowed.filter((a) => CATEGORY_OF[a.kind] === category);
  const selected = shown.find((a) => keyOf(a) === str(sp.sel)) ?? null;
  const detail = selected ?? shown[0] ?? null;

  // Links keep the other filters.
  const link = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { range: range === "7" ? "" : range, from: range === "custom" ? from : "", to: range === "custom" ? to : "", type: category === "all" ? "" : category, who: who === "all" ? "" : who, q, limit: limit > PAGE ? String(limit) : "" };
    for (const [k, v] of Object.entries({ ...cur, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/activity${s ? `?${s}` : ""}`;
  };

  // KPIs
  const perDay = new Map<string, { n: number; d: Date }>();
  for (const a of all) {
    const k = dhakaDay(a.at);
    perDay.set(k, { n: (perDay.get(k)?.n ?? 0) + 1, d: a.at });
  }
  const dayHint = [...perDay.entries()]
    .slice(0, 3)
    .map(([k, v]) => (k === today ? t("admin.activity.onToday", { n: num(v.n) }) : k === yesterday ? t("admin.activity.onYesterday", { n: num(v.n) }) : t("admin.activity.onDay", { n: num(v.n), day: shortDate(v.d) })))
    .join(" · ");
  const designs = all.filter((a) => a.kind === "design_sent");
  const byBrand = new Map<string, number>();
  for (const d of designs) if (d.contest) byBrand.set(d.contest.brand, (byBrand.get(d.contest.brand) ?? 0) + 1);
  const topBrand = [...byBrand.entries()].sort((a, b) => b[1] - a[1])[0];
  const signupsDesigners = all.filter((a) => a.kind === "signup_designer").length;
  const signupsClients = all.filter((a) => a.kind === "signup_client").length;
  const paid = all.filter((a) => a.kind === "contest_paid");

  const verb = (a: Activity) => t(`admin.activity.verbs.${a.kind}` as MessageKey);
  const target = (a: Activity) => (a.kind === "withdrawal" ? taka(Number(a.label)) : a.contest ? (a.entryNumber ? t("admin.activity.design", { brand: a.contest.brand, n: num(a.entryNumber) }) : a.contest.brand) : a.label || null);
  const line = (a: Activity): string | null => {
    const prize = a.contest ? taka(a.contest.prize) : "";
    switch (a.kind) {
      case "signup_client":
        return t("admin.activity.lines.newClient");
      case "signup_designer":
        return t("admin.activity.lines.newDesigner");
      case "design_sent":
        return t("admin.activity.lines.design", { n: num(a.entryNumber ?? 0), prize });
      case "comment":
        return a.text ?? t("admin.activity.lines.commentHidden");
      case "contest_started":
        return a.contest && (a.contest.status === "draft" || a.contest.status === "pending_payment")
          ? t("admin.activity.lines.notPaid")
          : a.contest?.endsAt
            ? t("admin.activity.lines.started", { prize, date: shortDate(a.contest.endsAt) })
            : t("admin.activity.lines.prize", { prize });
      case "contest_paid":
        return t("admin.activity.lines.paid", { prize });
      case "files_approved":
        return t("admin.activity.lines.files", { prize });
      case "withdrawal":
        return a.status ? t(`admin.activity.lines.withdrawal.${a.status}` as MessageKey) : null;
    }
  };
  const roleLabel = (a: Activity) => (a.person ? t(`admin.live.roles.${a.person.role}` as MessageKey) : null);

  // Days, newest first.
  const groups: { key: string; d: Date; items: Activity[] }[] = [];
  for (const a of shown) {
    const k = dhakaDay(a.at);
    const g = groups[groups.length - 1];
    if (g && g.key === k) g.items.push(a);
    else groups.push({ key: k, d: a.at, items: [a] });
  }

  const also = detail?.person ? all.filter((a) => a !== detail && a.person?.id === detail.person?.id && dhakaDay(a.at) === dhakaDay(detail.at)).slice(0, 5) : [];
  const daysLeft = detail?.contest?.endsAt && detail.contest.status === "open" ? Math.max(0, Math.ceil((detail.contest.endsAt.getTime() - now.getTime()) / 86_400_000)) : null;

  const details = detail && (
    <AdmCard as="aside" className="flex min-w-0 flex-[1_1_300px] flex-col gap-[18px] p-5 xl:sticky xl:top-[92px] xl:max-w-[360px]">
      <div className="flex items-center justify-between gap-2.5">
        <h2 className="m-0 text-[19px] font-semibold tracking-[-0.02em]">{t("admin.activity.details")}</h2>
        <span className="text-sm text-muted">
          {longDate(detail.at)}, {time(detail.at)}
        </span>
      </div>
      {detail.person ? (
        <div className="flex items-center gap-3 rounded-[14px] bg-adm-bg p-3.5">
          <span className="lc-d flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-tint text-[17px] font-semibold text-primary">{detail.person.name.trim().slice(0, 1).toUpperCase()}</span>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <strong className="truncate text-[16.5px]">{detail.person.name}</strong>
            <span className="text-[14.5px] text-muted">
              {roleLabel(detail)}
              {detail.person.created_at && ` · ${t("admin.activity.joined", { date: dhakaDay(new Date(detail.person.created_at)) === today ? `${t("admin.analytics.today")}, ${time(new Date(detail.person.created_at))}` : shortDate(new Date(detail.person.created_at)) })}`}
            </span>
          </div>
          <Link href={`/admin/users/${detail.person.id}`} className="inline-flex h-10 shrink-0 items-center rounded-[10px] border border-adm-line bg-surface px-3.5 text-sm font-bold text-adm-strong hover:border-primary hover:text-primary">
            {t("admin.activity.profile")}
          </Link>
        </div>
      ) : (
        <p className="m-0 rounded-[14px] bg-adm-bg p-3.5 text-[15px] text-muted">{t("admin.activity.someone")}</p>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-muted">{t("admin.activity.whatHappened")}</span>
        <p className="m-0 text-base">
          {verb(detail)} {target(detail) && <strong>{target(detail)}</strong>}
        </p>
        {line(detail) && <div className={cx("rounded-[14px] bg-adm-bg px-3.5 py-3 text-[15.5px] text-adm-strong", detail.kind === "comment" && "rounded-bl-[4px]")}>{line(detail)}</div>}
      </div>
      {detail.contest && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-muted">{t("admin.activity.contest")}</span>
          <Link href={`/admin/contests/${detail.contest.slug}`} className="flex flex-col gap-2 rounded-[12px] border border-adm-line p-3.5 hover:border-primary">
            <div className="flex items-center gap-2.5">
              <span className="lc-d flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-ink font-semibold text-white">{detail.contest.brand.trim().slice(0, 1).toUpperCase()}</span>
              <div className="flex min-w-0 flex-col gap-[3px]">
                <strong className="truncate text-base">{detail.contest.brand}</strong>
                <IdChip prefix="LC" n={detail.contest.number} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="lc-d text-xl font-semibold text-primary">{taka(detail.contest.prize)}</span>
              {daysLeft !== null ? <Pill tone={daysLeft <= 3 ? "bad" : "brand"}>{t("admin.activity.daysLeft", { n: num(daysLeft) })}</Pill> : <Pill>{t(`status.${detail.contest.status}` as MessageKey)}</Pill>}
            </div>
            {detail.contest.endsAt && <span className="text-[14.5px] text-muted">{t("admin.activity.ends", { date: shortDate(detail.contest.endsAt) })}</span>}
          </Link>
        </div>
      )}
      {also.length > 0 && detail.person && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-muted">{t("admin.activity.alsoBy", { name: detail.person.name })}</span>
          {also.map((a) => (
            <div key={keyOf(a)} className="flex justify-between gap-2.5 text-[15px]">
              <span className="min-w-0 truncate">
                {verb(a)} {target(a)}
              </span>
              <span className="shrink-0 text-muted">{time(a.at)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {detail.href && (
          <Link href={detail.href} className="inline-flex h-[46px] flex-[1_1_120px] items-center justify-center rounded-[12px] bg-primary px-4 text-[15px] font-bold text-white hover:bg-adm-deep">
            {detail.kind === "withdrawal" ? t("admin.nav.withdrawals") : t("admin.activity.open")}
          </Link>
        )}
        {detail.person && (
          <Link href={`/admin/messages?to=${detail.person.id}`} className="inline-flex h-[46px] flex-[1_1_120px] items-center justify-center rounded-[12px] border border-adm-line px-4 text-[15px] font-bold text-adm-strong hover:bg-adm-bg">
            {t("admin.activity.message")}
          </Link>
        )}
      </div>
    </AdmCard>
  );

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.activity.title")} lead={t("admin.activity.lead")} actions={<PeriodTabs base="/admin/activity" keys={KEYS} current={range} fallback="7" />} />
      {range === "custom" && <CustomRange base="/admin/activity" from={from} to={to} valid={Boolean(period)} />}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] sm:gap-4">
        {[
          { label: t("admin.activity.kpiActions"), value: all.length, hint: dayHint },
          { label: t("admin.activity.kpiDesigns"), value: designs.length, hint: topBrand ? t("admin.activity.forBrand", { n: num(topBrand[1]), brand: topBrand[0] }) : undefined },
          { label: t("admin.analytics.signups"), value: signupsDesigners + signupsClients, hint: t("admin.activity.signupsHint", { designers: num(signupsDesigners), clients: num(signupsClients) }) },
          { label: t("admin.analytics.paid"), value: paid.length, hint: paid.map((p) => p.contest?.brand).filter(Boolean).slice(0, 3).join(" · ") || undefined },
        ].map((k) => (
          <AdmCard key={k.label} as="div" className="flex min-w-0 flex-col gap-1.5 p-4 sm:p-5">
            <span className="text-[14.5px] font-semibold text-muted">{k.label}</span>
            <span className="lc-d text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[34px]">{num(k.value)}</span>
            {k.hint && <span className="truncate text-sm text-muted">{k.hint}</span>}
          </AdmCard>
        ))}
      </div>

      {selected && <div className="xl:hidden">{details}</div>}

      <div className="flex flex-wrap items-start gap-4">
        <AdmCard className="min-w-0 flex-[3_1_560px] overflow-hidden">
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            <nav aria-label={t("admin.activity.types")} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
              <ul className="m-0 flex w-max list-none gap-1.5 p-0">
                {CATEGORIES.map((c) => (
                  <li key={c}>
                    <Link
                      href={link({ type: c === "all" ? null : c, sel: null })}
                      aria-current={c === category ? "page" : undefined}
                      className={cx("flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-[15px] font-semibold", c === category ? "bg-tint text-primary" : "text-adm-strong hover:bg-adm-bg")}
                    >
                      {t(`admin.activity.categories.${c}`)}
                      <span className={cx("min-w-6 rounded-[7px] px-1.5 text-center text-[12.5px] font-bold tabular-nums", c === category ? "bg-surface" : "bg-[#f0f1f4]")}>{num(counts[c])}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <form action="/admin/activity" className="flex flex-wrap gap-2">
              {range !== "7" && <input type="hidden" name="range" value={range} />}
              {range === "custom" && (
                <>
                  <input type="hidden" name="from" value={from} />
                  <input type="hidden" name="to" value={to} />
                </>
              )}
              {category !== "all" && <input type="hidden" name="type" value={category} />}
              <label className="relative min-w-0 flex-[1_1_220px]">
                <span className="sr-only">{t("admin.activity.search")}</span>
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-adm-soft">
                  <AdminIcon name="search" />
                </span>
                <input type="search" name="q" defaultValue={q} placeholder={t("admin.activity.search")} className={cx(ADM_INPUT, "h-11 pl-10")} />
              </label>
              <label className="flex items-center gap-2 text-[15px] font-semibold text-adm-strong">
                <span>{t("admin.activity.who")}</span>
                <select name="who" defaultValue={who} className={cx(ADM_INPUT, "h-11 w-auto")}>
                  {WHO.map((w) => (
                    <option key={w} value={w}>
                      {t(`admin.activity.whoOptions.${w}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="h-11 rounded-[12px] bg-primary px-5 text-[15px] font-bold text-white hover:bg-adm-deep">
                {t("admin.search.go")}
              </button>
            </form>
          </div>

          {shown.length === 0 ? (
            <div className="px-5 pb-5">
              <AdmEmpty>{t("admin.activity.none")}</AdmEmpty>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.key}>
                <div className="flex items-center gap-2.5 border-t border-adm-line-soft bg-[#fafafb] px-5 py-3.5 text-sm font-bold text-adm-strong">
                  {dayTitle(g.d)}
                  <span className="min-w-6 rounded-[7px] border border-adm-line bg-surface px-1.5 text-center text-[12.5px] tabular-nums">{num(g.items.length)}</span>
                </div>
                {g.items.map((a) => {
                  const on = detail === a;
                  return (
                    <Link key={keyOf(a)} href={link({ sel: keyOf(a) })} scroll={false} aria-current={on ? "true" : undefined} className={cx("flex items-start gap-3.5 border-t border-adm-line-soft px-5 py-4", on ? "bg-adm-row" : "hover:bg-[#fafafb]")}>
                      <span className="lc-d w-12 shrink-0 pt-2 text-[14.5px] font-semibold tabular-nums text-muted">{time(a.at)}</span>
                      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[#f0f1f4] text-adm-strong max-sm:hidden">
                        <AdminIcon name={KIND_ICON[a.kind]} size={17} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-base">
                          <strong>{a.person?.name ?? t("admin.activity.someone")}</strong> {verb(a)} {target(a) && <strong className="text-primary">{target(a)}</strong>}
                        </span>
                        {line(a) && <span className="line-clamp-2 text-[14.5px] text-muted">{line(a)}</span>}
                        <span className="flex flex-wrap gap-1.5 pt-0.5">
                          {roleLabel(a) && <Pill>{roleLabel(a)}</Pill>}
                          {a.contest?.number ? <IdChip prefix="LC" n={a.contest.number} /> : null}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))
          )}
          {all.length >= limit && limit < MAX && (
            <div className="flex justify-center border-t border-adm-line-soft p-4">
              <Link href={link({ limit: String(Math.min(MAX, limit + PAGE)) })} scroll={false} className="inline-flex h-11 items-center rounded-[12px] border border-adm-line bg-surface px-5 text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
                {t("admin.activity.older")}
              </Link>
            </div>
          )}
        </AdmCard>

        <div className="contents max-xl:hidden">{details}</div>
      </div>
    </div>
  );
}

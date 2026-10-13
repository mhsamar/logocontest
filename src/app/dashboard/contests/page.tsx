import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProContestCard } from "@/components/pro/contest-card";
import { Icon } from "@/components/pro/parts";
import { AlertTypes, PrefToggle } from "@/components/pro/pref-toggles";
import { ProWorkspace, WsHead } from "@/components/pro/workspace";
import { getCurrentUser } from "@/lib/auth/session";
import { savedContestIds } from "@/lib/contests/community";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { getProSettings } from "@/lib/pro/settings";
import { isPro } from "@/lib/pro/status";
import { myInvitations, openContests, proPrefs, serviceNames } from "@/lib/pro/workspace";
import { activeServices } from "@/lib/services/store";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pro.contests.title"), robots: { index: false } };
}

const FILTERS = ["early", "invited", "all", "ending", "prize", "private"] as const;
type Filter = (typeof FILTERS)[number];

// Pro › Contests (owner, 2026-10-13; Design/pro/pro-contests.html): every open contest with the early-access ones and
// the invitations marked, and the instant-alert switches. Basic designers use Browse Contests.
export default async function ProContestsPage({ searchParams }: PageProps<"/dashboard/contests">) {
  const [{ t, locale }, user, sp] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);
  if (!user) redirect("/login?as=designer&next=%2Fdashboard%2Fcontests");
  if (user.role !== "designer") redirect("/dashboard");
  if (!(await isPro(user.id))) redirect("/contests");
  const q = typeof sp.q === "string" ? sp.q.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  const [{ settings }, all, invitations, prefs, names, services] = await Promise.all([getProSettings(), openContests(), myInvitations(user.id), proPrefs(user.id), serviceNames(locale), activeServices()]);
  const invited = new Set(invitations.map((i) => i.contest.id));
  const early = all.filter((c) => c.opensToAll);
  const defaultFilter: Filter = early.length ? "early" : "all";
  const f: Filter = FILTERS.find((x) => x === sp.f) ?? defaultFilter;
  const words = q.toLowerCase();
  let list = all.filter((c) => !words || (c.brand ?? "").toLowerCase().includes(words) || (names.get(c.service) ?? "").toLowerCase().includes(words));
  if (f === "early") list = list.filter((c) => c.opensToAll);
  if (f === "invited") list = list.filter((c) => invited.has(c.id));
  if (f === "private") list = list.filter((c) => c.isPrivate);
  if (f === "ending") list = [...list].sort((a, b) => (a.endsAt?.getTime() ?? Infinity) - (b.endsAt?.getTime() ?? Infinity));
  if (f === "prize") list = [...list].sort((a, b) => b.prize - a.prize);
  const saved = await savedContestIds(user.id, list.map((c) => c.id));
  const n = (v: number) => formatNumber(v, locale);
  const href = (x: Filter) => `/dashboard/contests?f=${x}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const count: Partial<Record<Filter, number>> = { early: early.length, invited: invited.size, all: all.length };

  return (
    <ProWorkspace user={user} active="contests">
      <WsHead title={t("pro.contests.title")} lead={settings.features.early_access ? t("pro.contests.lead") : t("pro.contests.leadOff")} />
      <div className="pr-filters">
        <form className="pr-search" action="/dashboard/contests" role="search">
          <Icon name="search" />
          <input type="hidden" name="f" value={f} />
          <input name="q" defaultValue={q} placeholder={t("pro.contests.search")} aria-label={t("pro.contests.search")} />
        </form>
        {FILTERS.filter((x) => (x !== "early" || settings.features.early_access) && (x !== "invited" || settings.features.invitations)).map((x) => (
          <Link key={x} href={href(x)} className={`pr-chip${f === x ? " on" : ""}${x === "early" ? " gold" : ""}`} aria-current={f === x ? "true" : undefined}>
            {t(`pro.contests.${x === "private" ? "privateChip" : x}`)}
            {count[x] !== undefined && <em>{n(count[x]!)}</em>}
          </Link>
        ))}
      </div>
      <div className="pr-g2 side">
        {list.length ? (
          <div className="pr-cg">
            {list.map((c) => (
              <ProContestCard key={c.id} c={c} saved={saved.has(c.id)} invited={invited.has(c.id)} names={names} t={t} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="pr-empty">{t("pro.contests.empty")}</p>
        )}
        <aside className="pr-card" aria-labelledby="pr-alerts">
          <div className="pr-ch">
            <h2 id="pr-alerts">{t("pro.contests.alerts")}</h2>
          </div>
          <p className="pr-hint">{t("pro.contests.alertsLead")}</p>
          <AlertTypes options={services.map((s) => ({ slug: s.slug, name: names.get(s.slug) ?? s.slug }))} picked={prefs.alertServices} />
          <p className="pr-kick dk" style={{ marginTop: 14 }}>
            {t("pro.contests.alertsTo")}
          </p>
          <PrefToggle pref="alert_app" on={prefs.alertApp} label={t("pro.contests.app")} />
          <PrefToggle pref="alert_email" on={prefs.alertEmail} label={t("pro.contests.email")} />
        </aside>
      </div>
    </ProWorkspace>
  );
}


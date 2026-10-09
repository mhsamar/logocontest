import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { AdminHead } from "@/components/admin/page-head";
import { liveVisitors } from "@/lib/admin/analytics";
import { requirePermission } from "@/lib/admin/core";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.live.title"), robots: { index: false } };
}

// A-19 Live now (BLUEPRINT §13.2 item 3): who is on the site in the last 2 minutes.
export default async function AdminLivePage() {
  await requirePermission("live.view");
  const now = new Date();
  const [{ t, locale }, list] = await Promise.all([getI18n(), liveVisitors(now)]);
  const num = (n: number) => formatNumber(n, locale);
  const members = list.filter((v) => v.person).length;
  const tiles = [
    { label: t("admin.live.online"), value: list.length, tone: "text-success" },
    { label: t("admin.live.members"), value: members, tone: "text-ink" },
    { label: t("admin.live.guests"), value: list.length - members, tone: "text-ink" },
  ];

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={10} />
      <AdminHead title={t("admin.live.title")} lead={t("admin.live.lead")} />
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{x.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${x.tone}`}>{num(x.value)}</p>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.live.none")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line">
          {list.map((v) => (
            <li key={v.visitorId} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_auto_auto] sm:items-center sm:gap-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative flex size-2.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-success" />
                </span>
                {v.person ? (
                  <Link href={`/admin/users/${v.person.id}`} className="truncate font-semibold text-ink hover:text-primary">
                    {v.person.name}
                  </Link>
                ) : (
                  <span className="text-muted">{t("admin.live.guest")}</span>
                )}
                {v.person && <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{t(`admin.live.roles.${v.person.role}` as MessageKey)}</span>}
              </div>
              <a href={v.path} target="_blank" rel="noopener" className="truncate font-mono text-xs text-ink hover:text-primary">
                {v.path}
              </a>
              <span className="text-xs text-muted">
                {t(`admin.live.devices.${v.device}` as MessageKey)}
                {v.country ? ` · ${v.country}` : ""}
              </span>
              <span className="text-xs text-muted tabular-nums">
                {t("admin.live.minutes", { n: Math.max(1, Math.round((now.getTime() - v.startedAt.getTime()) / 60000)) })} ·{" "}
                {t("admin.live.ago", { n: Math.max(0, Math.round((now.getTime() - v.lastSeen.getTime()) / 1000)) })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

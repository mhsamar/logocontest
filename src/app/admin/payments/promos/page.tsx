import type { Metadata } from "next";
import { AdminHead } from "@/components/admin/page-head";
import { str } from "@/components/admin/table-bits";
import { AdmCard, AdmEmpty, CardTitle, Pill, Tabs } from "@/components/admin/ui";
import { PromoCreator, PromoToggle } from "@/components/payments/admin-pay";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { promoLines, type PromoLine } from "@/lib/payments/admin-queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pay.admin.promos.title"), robots: { index: false } };
}

const FILTERS = ["all", "client", "designer", "active", "paused"] as const;
type Filter = (typeof FILTERS)[number];

// Admin › Payments › Promo codes (owner, 2026-10-14): random one-time codes (a batch) or one shared code; clients get
// a lower contest fee (20/15/10/5/0%), designers a lower fee on their next win (15/10/5/0%) or money off Pro.
export default async function PromoCodesPage({ searchParams }: PageProps<"/admin/payments/promos">) {
  const admin = await requirePermission("payments.view");
  const canManage = hasPermission(admin, "payments.manage");
  const sp = await searchParams;
  const filter: Filter = FILTERS.find((x) => x === str(sp.f)) ?? "all";
  const [{ t, locale }, lines] = await Promise.all([getI18n(), promoLines()]);
  const num = (n: number) => formatNumber(n, locale);
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const day = (d: Date) => d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });
  const now = new Date();

  const state = (l: PromoLine): { tone: "good" | "warn" | "neutral" | "bad"; label: string } => {
    const f = l.first;
    if (!l.active) return { tone: "neutral", label: t("pay.admin.promos.paused") };
    if (f.endsAt && f.endsAt <= now) return { tone: "bad", label: t("pay.admin.promos.expired") };
    if (f.startsAt && f.startsAt > now) return { tone: "warn", label: t("pay.admin.promos.notYet") };
    return { tone: "good", label: t("pay.admin.promos.active") };
  };
  const shown = lines.filter((l) => (filter === "all" ? true : filter === "active" ? l.active : filter === "paused" ? !l.active : l.first.audience === filter));

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("pay.admin.promos.title")} lead={t("pay.admin.promos.lead")} crumbs={[{ href: "/admin/payments", label: t("admin.payments.title") }]} />
      <div className="flex flex-wrap items-start gap-4">
        {canManage && (
          <AdmCard className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 p-5 xl:max-w-[420px]">
            <CardTitle title={t("pay.admin.promos.newTitle")} />
            <PromoCreator />
          </AdmCard>
        )}
        <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-3">
          <Tabs label={t("pay.admin.promos.list")} items={FILTERS.map((x) => ({ href: `/admin/payments/promos${x === "all" ? "" : `?f=${x}`}`, label: t(`pay.admin.promos.filters.${x}`), active: x === filter }))} />
          {shown.length === 0 && <AdmEmpty>{t("pay.admin.promos.empty")}</AdmEmpty>}
          {shown.map((l) => {
            const f = l.first;
            const s = state(l);
            const batch = l.batchId !== null;
            return (
              <AdmCard key={l.key} as="article" className="flex flex-col gap-3 p-4 sm:p-5" data-promo-line={l.key}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="font-mono text-[17px] tracking-wide text-ink">{batch ? t("pay.admin.promos.batch", { n: num(l.codes.length) }) : f.code}</strong>
                      <Pill tone={s.tone}>{s.label}</Pill>
                      <Pill tone={f.audience === "client" ? "brand" : "gold"}>{t(`pay.admin.promos.audiences.${f.audience}`)}</Pill>
                    </span>
                    <span className="text-[15px] font-semibold text-ink">{t(`pay.admin.promos.effect.${f.kind}`, { n: num(f.value) })}</span>
                    <span className="text-[14px] text-muted">
                      {[f.label, t(`pay.admin.promos.modes.${f.mode}`), f.startsAt ? t("pay.admin.promos.starts", { date: day(f.startsAt) }) : null, f.endsAt ? t("pay.admin.promos.ends", { date: day(f.endsAt) }) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className="text-right text-[14.5px] font-semibold text-ink">
                    {!batch && f.maxUses ? t("pay.admin.promos.usesMax", { used: num(l.used), max: num(f.maxUses) }) : t("pay.admin.promos.uses", { used: num(l.used), reserved: num(l.reserved) })}
                  </span>
                </div>
                {batch && (
                  <details className="group">
                    <summary className="min-h-11 cursor-pointer list-none text-[14.5px] font-bold text-primary">{t("pay.admin.promos.showCodes")}</summary>
                    <ul className="m-0 mt-2 flex max-h-64 list-none flex-wrap gap-1.5 overflow-auto p-0">
                      {l.codes.map((c) => (
                        <li key={c.id} className={c.used ? "rounded-[8px] bg-[#f0f1f4] px-2 py-1 font-mono text-[13px] text-muted line-through" : "rounded-[8px] bg-[#f4f5f7] px-2 py-1 font-mono text-[13px] font-semibold text-ink"}>
                          {c.code}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/admin/payments/promos/export?key=${l.key}`} className="inline-flex min-h-11 items-center rounded-[12px] border border-adm-line px-4 text-[14.5px] font-bold text-ink hover:border-primary">
                    {t("pay.admin.promos.csv")}
                  </a>
                  {canManage && <PromoToggle id={batch ? undefined : f.id} batchId={l.batchId} active={l.active} />}
                </div>
              </AdmCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

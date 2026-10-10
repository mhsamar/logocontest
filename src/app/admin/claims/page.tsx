import type { Metadata } from "next";
import { ClaimActions } from "@/components/admin/claim-actions";
import { listOpenClaims } from "@/lib/claims/queries";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { DesignLink } from "@/components/admin/design-viewer";
import { requirePermission } from "@/lib/admin/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.claims.title"), robots: { index: false } };
}

// A-13 Copy claims (BLUEPRINT §7.6, owner 2026-10-09).
export default async function AdminClaimsPage() {
  await requirePermission("claims.view");
  const [{ t, locale }, claims] = await Promise.all([getI18n(), listOpenClaims()]);
  return (
    <div>
      <h1 className="text-h2 font-bold tracking-tight text-ink lg:text-h2-lg">{t("admin.claims.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("admin.claims.lead")}</p>
      {claims.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.claims.empty")}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {claims.map((c) => (
            <li key={c.id} className="grid gap-5 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,22rem)]">
              <DesignLink entryId={c.entryId} className="block overflow-clip rounded-xl bg-canvas ring-1 ring-line">
                {c.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.coverUrl} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <span className="flex aspect-square items-center justify-center text-sm text-muted">#{formatNumber(c.entryNumber, locale)}</span>
                )}
              </DesignLink>
              <div className="min-w-0 space-y-2 text-sm">
                <p className="text-lg font-bold text-ink">
                  {c.contest.brand}{" "}
                  <span className="text-sm font-medium text-muted">
                    {c.contest.number ? `#${String(c.contest.number).padStart(5, "0")} · ` : ""}
                    {t("admin.claims.design", { n: formatNumber(c.entryNumber, locale) })}
                  </span>
                </p>
                <p className="text-muted">
                  {t("admin.claims.people", { client: c.client.name, designer: c.designer.username ? `@${c.designer.username}` : c.designer.name })} ·{" "}
                  {t("admin.claims.filed", { date: formatDate(c.createdAt, locale, "short") })} · {t(`admin.claims.handover.${c.handoverStatus}` as MessageKey)}
                </p>
                <p className="whitespace-pre-line rounded-xl bg-canvas p-3 text-ink">{c.note}</p>
                {c.links.length > 0 && (
                  <ul className="space-y-1">
                    {c.links.map((l) => (
                      <li key={l}>
                        <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-primary hover:underline">
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <ClaimActions claimId={c.id} balance={formatTaka(c.designer.balance, locale)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

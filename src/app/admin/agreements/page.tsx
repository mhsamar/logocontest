import type { Metadata } from "next";
import { RevealId } from "@/components/admin/reveal-id";
import { listAgreements } from "@/lib/agreements/queries";
import { authorize } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { formatBdMobile } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.agreements.title"), robots: { index: false } };
}

// A-13 Designer agreements (BLUEPRINT §9.6, owner 2026-10-09): ID numbers masked; each full reveal is logged.
export default async function AdminAgreementsPage() {
  await authorize("admin.access");
  const [{ t, locale }, list] = await Promise.all([getI18n(), listAgreements()]);
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  return (
    <div>
      <h1 className="text-h2 font-bold tracking-tight text-ink lg:text-h2-lg">{t("admin.agreements.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("admin.agreements.lead")}</p>
      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.agreements.empty")}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((a) => (
            <li
              key={a.designerId}
              className="grid gap-x-6 gap-y-2 rounded-2xl bg-surface p-4 text-sm shadow-card ring-1 ring-line md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {a.fullName}
                  {a.username && <span className="font-normal text-muted"> @{a.username}</span>}
                  {a.status !== "active" && <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">{a.status}</span>}
                </p>
                <p className="text-muted">{formatBdMobile(a.mobile)}</p>
                <p className="text-muted">{a.address}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`agreement.idTypes.${a.idType}`)}</p>
                <RevealId designerId={a.designerId} masked={a.idMasked} />
              </div>
              <div className="text-muted">
                <p>{t("admin.agreements.signed", { date: when(a.signedAt) })}</p>
                <p>
                  v{a.version}
                  {a.signedIp && ` · IP ${a.signedIp}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

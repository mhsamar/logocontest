import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { authorize } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { robots: { index: false } };

export default async function AdminPage() {
  const user = await authorize("admin.access");
  const { t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-page px-4 py-8">
      <h1 className="text-h1 font-bold tracking-tight text-ink">{t("admin.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("admin.signedInAs", { name: user.name })}</p>
      <Link
        href="/admin/withdrawals"
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-5 font-semibold text-ink shadow-card ring-1 ring-line transition-shadow hover:shadow-raised"
      >
        {t("admin.withdrawals.link")} →
      </Link>
      <div className="mt-8">
        <EmptyState title={t("admin.empty")} body={t("admin.emptyBody")} />
      </div>
    </div>
  );
}

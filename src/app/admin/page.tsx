import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { authorize } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.title"), robots: { index: false } };
}

export default async function AdminPage() {
  const user = await authorize("admin.access");
  const { t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-page px-4 py-8">
      <h1 className="text-h1 font-bold tracking-tight text-ink">{t("admin.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("admin.signedInAs", { name: user.name })}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {[
          { href: "/admin/withdrawals", label: t("admin.withdrawals.link") },
          { href: "/admin/claims", label: t("admin.claims.link") },
          { href: "/admin/agreements", label: t("admin.agreements.link") },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-5 font-semibold text-ink shadow-card ring-1 ring-line transition-shadow hover:shadow-raised"
          >
            {l.label} →
          </Link>
        ))}
      </div>
      <div className="mt-8">
        <EmptyState title={t("admin.empty")} body={t("admin.emptyBody")} />
      </div>
    </div>
  );
}

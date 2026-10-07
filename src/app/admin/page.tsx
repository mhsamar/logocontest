import type { Metadata } from "next";
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
      <div className="mt-8">
        <EmptyState title={t("admin.empty")} body={t("admin.emptyBody")} />
      </div>
    </div>
  );
}

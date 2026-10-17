import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClientShell } from "@/components/client/shell";
import { SettingsBody } from "@/components/settings/settings-body";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("settings.meta.title"), robots: { index: false } };
}

// Premium client workspace › Settings (owner, 2026-10-17: the right-side menu stays on every client page): photo,
// name, username, mobile, email and password, the same sections as before.
export default async function ClientSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=client&next=%2Fclient%2Fsettings");
  if (user.role !== "client") redirect("/dashboard/profile");
  const { t } = await getI18n();
  return (
    <ClientShell user={user} active="settings">
      <div className="phd2">
        <div>
          <div className="dnl">
            <h1>{t("settings.title")}</h1>
          </div>
        </div>
      </div>
      <SettingsBody user={user} bare />
    </ClientShell>
  );
}

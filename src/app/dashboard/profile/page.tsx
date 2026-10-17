import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SmallPageHeader } from "@/components/ui/section-heading";
import { PageShell } from "@/components/ui/panel";
import { SettingsBody } from "@/components/settings/settings-body";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { ProSettingsExtras } from "@/components/pro/pro-settings";
import { ProWorkspace, WsHead } from "@/components/pro/workspace";
import { isPro } from "@/lib/pro/status";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("settings.meta.title"), robots: { index: false } };
}

// D-12 My profile: settings for designers. A client's settings are in the client workspace (/client/settings).
export default async function ProfileSettingsPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect("/login?next=/dashboard/profile");
  if (user.role === "client") redirect("/client/settings");
  if (user.role !== "designer") notFound();
  // Designer Pro plan (owner, 2026-10-13): Pro designers get their Pro extras and subscription on top, in the workspace.
  if (await isPro(user.id))
    return (
      <ProWorkspace user={user} active="settings">
        <WsHead
          title={t("pro.settings.title")}
          lead={t("pro.settings.lead")}
          action={
            user.username ? (
              <Link href={`/designer/${user.username}`} className="pr-out">
                {t("pro.settings.viewProfile")}
              </Link>
            ) : undefined
          }
        />
        <ProSettingsExtras user={user} />
        <SettingsBody user={user} />
      </ProWorkspace>
    );
  return (
    <PageShell>
      {/* Owner, 2026-10-13: no big title panel; a small title beside the back button. */}
      <SmallPageHeader title={t("settings.title")} back={{ href: "/dashboard", label: t("nav.dashboard") }} />
      <SettingsBody user={user} />
    </PageShell>
  );
}

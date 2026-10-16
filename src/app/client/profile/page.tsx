import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { profileTab, ClientProfileView } from "@/components/client/profile-view";
import { ClientShell } from "@/components/client/shell";
import { getCurrentUser } from "@/lib/auth/session";
import { clientProfileData } from "@/lib/client/workspace";
import { siteOrigin } from "@/lib/email";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("cw.profile.metaTitle"), robots: { index: false } };
}

// Premium client workspace › My profile (owner, 2026-10-16; Design/client-premium/client-profile.html): what designers
// see, with Start a contest, Share and the privacy switch.
export default async function ClientOwnProfilePage({ searchParams }: PageProps<"/client/profile">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=client&next=%2Fclient%2Fprofile");
  if (user.role !== "client") redirect("/dashboard");
  const sp = await searchParams;
  const [{ t, locale }, p, origin] = await Promise.all([getI18n(), clientProfileData({ id: user.id }), siteOrigin()]);
  if (!p) redirect("/client");
  return (
    <ClientShell user={user} active="profile">
      <ClientProfileView p={p} owner tab={profileTab(sp.tab)} base="/client/profile" publicUrl={`${origin}/c/${p.username ?? ""}`} t={t} locale={locale} />
    </ClientShell>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DesignerDashboard } from "@/components/dashboard/designer-dashboard";
import { ProDashboard } from "@/components/pro/pro-dashboard";
import { isPro } from "@/lib/pro/status";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { countSaved } from "@/lib/contests/community";
import { designerById, designerContests } from "@/lib/designers/profile";
import { openHandovers } from "@/lib/handover/queries";
import { myUnclaimedRewards } from "@/lib/rewards/claims";
import { designerWinCards, winCardImage } from "@/lib/rewards/win-cards";
import { getWallet } from "@/lib/wallet/queries";
import { canonicalOrigin } from "@/lib/site-hosts";
import { qrSvg } from "@/lib/profile/qr";
import { getI18n } from "@/lib/i18n/server";
import { profileSteps } from "@/lib/profile/completeness";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("dashboard.meta.title"), robots: { index: false } };
}

// D-02 Designer dashboard; the client's dashboard (C-13) is the premium client workspace at /client.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  // Designers have their own dashboard (D-02).
  if (user.role === "designer") {
    // Designer Pro plan (owner, 2026-10-13): Pro designers get the Pro workspace; Basic keeps this dashboard.
    if (await isPro(user.id)) return <ProDashboard user={user} />;
    const designer = await designerById(user.id);
    if (!designer) notFound();
    const profileUrl = `${canonicalOrigin()}/d/${designer.username}`;
    const [contests, savedCount, qr, handovers, wallet, cards, prizes, langs] = await Promise.all([
      designerContests(user.id),
      countSaved(user.id),
      qrSvg(profileUrl),
      openHandovers(user.id),
      getWallet(user.id),
      designerWinCards(user.id),
      myUnclaimedRewards(user.id),
      // Languages (migration 0042); null when that column can't be read, then it isn't asked for.
      createAdminClient().from("profiles").select("languages").eq("id", user.id).maybeSingle(),
    ]);
    // "Complete your profile" (owner, 2026-10-13): sign-up has only four steps.
    const profileStepsList = profileSteps({
      avatarUrl: designer.avatarUrl,
      bio: designer.bio,
      skills: designer.skills,
      tools: designer.tools,
      experienceYears: designer.experienceYears,
      languages: langs.error || !langs.data ? null : ((langs.data.languages as string[] | null) ?? []),
      emailVerified: Boolean(user.emailVerifiedAt),
    });
    const winCards = cards.map((c) => ({ slug: c.slug, brand: c.hiddenLogo ? null : c.contest.brand, image: winCardImage(c.slug, "square", c.squarePath) }));
    return <DesignerDashboard designer={designer} contests={contests} savedCount={savedCount} profileUrl={profileUrl} qrSvg={qr} handovers={handovers} wallet={wallet} winCards={winCards} prizes={prizes} profileSteps={profileStepsList} />;
  }
  if (can(user, "admin.access")) redirect("/admin");
  if (user.role !== "client") notFound();
  // Premium client workspace (owner, 2026-10-16): the client's dashboard is /client.
  redirect("/client");
}

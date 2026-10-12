import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EmailForm, MobileForm, PasswordForm, PayoutForm, PhotoSection, ProfileForm, Section, type PayoutValues } from "@/components/settings/settings-forms";
import { PortfolioForm } from "@/components/settings/portfolio-form";
import { formatBdMobile } from "@/lib/phone";
import { BackLink } from "@/components/ui/back-link";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/auth/session";
import { siteOrigin } from "@/lib/email";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("settings.meta.title"), robots: { index: false } };
}

// D-12 My profile / C-20 Profile: settings for designers and clients.
export default async function ProfileSettingsPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect("/login?next=/dashboard/profile");
  if (user.role !== "designer" && user.role !== "client") notFound();

  const [{ data: profile }, s] = await Promise.all([
    createAdminClient().from("profiles").select("name, bio, business_name, username, skills, tools, experience_years").eq("id", user.id).single(),
    getSettings(["limits.designer_bio_max_length", "auth.password_min_length"]),
  ]);
  let payout: PayoutValues | null = null;
  if (user.role === "designer") {
    const { data: p } = await createAdminClient()
      .from("designer_payout_methods")
      .select("type, bkash_number, bank_name, branch, account_name, account_number, routing_number")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .maybeSingle();
    payout = {
      type: p?.type === "bank" ? "bank" : "bkash",
      bkashNumber: p?.bkash_number ? formatBdMobile(p.bkash_number) : "",
      bankName: p?.bank_name ?? "",
      branch: p?.branch ?? "",
      accountName: p?.account_name ?? "",
      accountNumber: p?.account_number ?? "",
      routingNumber: p?.routing_number ?? "",
    };
  }
  // Designers have a public profile page (P-06); the client one (P-12) comes later.
  // The public profile: /d/ for designers, /c/ for clients (P-06, P-12).
  const profileUrl = user.username ? `${await siteOrigin()}/${user.role === "designer" ? "d" : "c"}/${user.username}` : null;

  return (
    <PageShell>
      <BackLink href="/dashboard">{t("nav.dashboard")}</BackLink>
      <Panel as="header" className="max-[720px]:py-6">
        <PageTitle lead={t("settings.title")} sub={t("settings.subtitle")} />
      </Panel>

      <Panel tone="grey" className="max-[720px]:py-4">
        <div className="mx-auto max-w-3xl space-y-3.5">
          <Section title={t("settings.profileTitle")}>
            <PhotoSection name={user.name} avatarUrl={user.avatarUrl} />
            <div className="mt-6 border-t border-line pt-6">
              <ProfileForm
                role={user.role}
                name={profile?.name ?? user.name}
                bio={profile?.bio ?? ""}
                businessName={profile?.business_name ?? ""}
                username={user.role === "designer" ? (profile?.username ?? null) : null}
                profileUrl={profileUrl}
                bioMax={s["limits.designer_bio_max_length"]}
              />
            </div>
          </Section>
          {user.role === "designer" && (
            <Section title={t("portfolio.title")} subtitle={t("portfolio.subtitle")}>
              <PortfolioForm skills={(profile?.skills ?? []) as string[]} tools={(profile?.tools ?? []) as string[]} experienceYears={(profile?.experience_years as number | null) ?? null} />
            </Section>
          )}
          {payout && (
            <Section title={t("settings.payout.title")} subtitle={t("settings.payout.subtitle")}>
              <PayoutForm initial={payout} />
            </Section>
          )}
          <Section title={t("settings.mobile.title")} subtitle={t("settings.mobile.subtitle")}>
            <MobileForm mobile={user.mobile} />
          </Section>
          <Section title={t("settings.email.title")} subtitle={t("settings.email.subtitle")}>
            <EmailForm email={user.email ?? ""} verified={Boolean(user.emailVerifiedAt)} />
          </Section>
          <Section title={t("settings.password.title")}>
            <PasswordForm min={s["auth.password_min_length"]} />
          </Section>
        </div>
      </Panel>
    </PageShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmailForm, MobileForm, PasswordForm, PayoutForm, PhotoSection, ProfileForm, Section, type PayoutValues } from "@/components/settings/settings-forms";
import { formatBdMobile } from "@/lib/phone";
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
    createAdminClient().from("profiles").select("name, bio, business_name, username").eq("id", user.id).single(),
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
  const profileUrl = user.role === "designer" && user.username ? `${await siteOrigin()}/d/${user.username}` : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        ← {t("nav.dashboard")}
      </Link>
      <h1 className="mt-1 text-h1 font-bold tracking-tight text-ink lg:text-h1-lg">{t("settings.title")}</h1>
      <p className="mt-2 text-muted">{t("settings.subtitle")}</p>

      <div className="mt-8 space-y-5">
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
    </div>
  );
}

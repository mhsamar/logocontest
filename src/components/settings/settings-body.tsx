import { EmailForm, MobileForm, PasswordForm, PayoutForm, PhotoSection, ProfileForm, Section, type PayoutValues } from "@/components/settings/settings-forms";
import { PortfolioForm } from "@/components/settings/portfolio-form";
import { ProfileProgress } from "@/components/settings/profile-progress";
import { PhoneNotifications } from "@/components/push/phone-notifications";
import { Panel } from "@/components/ui/panel";
import type { CurrentUser } from "@/lib/auth/policies";
import { linkOrigin } from "@/lib/site-origin";
import { getI18n } from "@/lib/i18n/server";
import { formatBdMobile } from "@/lib/phone";
import { bioIdeas } from "@/lib/profile/bio-ideas";
import { profileSteps } from "@/lib/profile/completeness";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * D-12 My profile / C-20 Profile: the settings sections for designers and clients. Order (owner, 2026-10-15): photo,
 * name and bio; payout; mobile; email; password; then the portfolio. Shared by /dashboard/profile (designers) and
 * /client/settings (clients, in the client workspace since 2026-10-17); `bare` leaves out the grey panel there.
 */
export async function SettingsBody({ user, bare = false }: { user: CurrentUser; bare?: boolean }) {
  const { t, locale } = await getI18n();
  const [{ data: profile }, extrasRes, s] = await Promise.all([
    createAdminClient().from("profiles").select("name, bio, username, skills, tools, experience_years, whatsapp").eq("id", user.id).single(),
    // Profile extras (migration 0042); before that SQL runs the query fails and the fields stay hidden.
    createAdminClient().from("profiles").select("languages, skill_levels, tool_years").eq("id", user.id).maybeSingle(),
    getSettings(["limits.designer_bio_max_length", "auth.password_min_length", "auth.email_code_length"]),
  ]);
  let payout: PayoutValues | null = null;
  if (user.role === "designer") {
    const { data: p } = await createAdminClient()
      .from("designer_payout_methods")
      .select("type, bkash_number, bkash_kind, bank_name, branch, account_name, account_number, routing_number")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .maybeSingle();
    payout = {
      type: p?.type === "bank" ? "bank" : "bkash",
      bkashNumber: p?.bkash_number ? formatBdMobile(p.bkash_number) : "",
      bkashKind: p?.bkash_kind === "personal" || p?.bkash_kind === "agent" ? p.bkash_kind : "",
      bankName: p?.bank_name ?? "",
      branch: p?.branch ?? "",
      accountName: p?.account_name ?? "",
      accountNumber: p?.account_number ?? "",
      routingNumber: p?.routing_number ?? "",
    };
  }
  // "Complete your profile" for designers (owner, 2026-10-13).
  const steps =
    user.role === "designer"
      ? profileSteps({
          avatarUrl: user.avatarUrl,
          bio: profile?.bio ?? null,
          skills: (profile?.skills ?? []) as string[],
          tools: (profile?.tools ?? []) as string[],
          experienceYears: (profile?.experience_years as number | null) ?? null,
          languages: extrasRes.error || !extrasRes.data ? null : ((extrasRes.data.languages as string[] | null) ?? []),
          emailVerified: Boolean(user.emailVerifiedAt),
        })
      : null;
  // Designers have a public profile page (P-06); the client one (P-12) comes later.
  // The public profile: /d/ for designers, /c/ for clients (P-06, P-12).
  const profileUrl = user.username ? `${await linkOrigin()}/${user.role === "designer" ? "d" : "c"}/${user.username}` : null;


  const content = <div className={bare ? "space-y-4" : "mx-auto max-w-3xl space-y-3.5"}>
          {steps && <ProfileProgress steps={steps} onSettings />}
          <Section id="profile" title={t("settings.profileTitle")}>
            <PhotoSection name={user.name} avatarUrl={user.avatarUrl} />
            <div className="mt-6 border-t border-line pt-6">
              <ProfileForm
                role={user.role === "designer" ? "designer" : "client"}
                name={profile?.name ?? user.name}
                bio={profile?.bio ?? ""}
                username={profile?.username ?? null}
                profileUrl={profileUrl}
                bioMax={s["limits.designer_bio_max_length"]}
                usernameNote={t("settings.username.note")}
                bioIdeas={
                  user.role === "designer"
                    ? bioIdeas(
                        {
                          name: profile?.name ?? user.name,
                          skills: (profile?.skills ?? []) as string[],
                          tools: (profile?.tools ?? []) as string[],
                          years: (profile?.experience_years as number | null) ?? null,
                          max: s["limits.designer_bio_max_length"],
                        },
                        t,
                        locale,
                      )
                    : []
                }
              />
            </div>
          </Section>
          {payout && (
            <Section title={t("settings.payout.title")} subtitle={t("settings.payout.subtitle")}>
              <PayoutForm initial={payout} />
            </Section>
          )}
          <Section title={t("settings.mobile.title")} subtitle={t("settings.mobile.subtitle")}>
            <MobileForm mobile={user.mobile} whatsapp={profile?.whatsapp === true} />
          </Section>
          <Section id="email" title={t("settings.email.title")} subtitle={t("settings.email.subtitle")}>
            <EmailForm email={user.email ?? ""} verified={Boolean(user.emailVerifiedAt)} codeLength={s["auth.email_code_length"]} />
          </Section>
          {/* Owner, 2026-10-22: designers and clients turn on phone notifications here, on each device. */}
          <Section id="notifications" title={t("push.device.title")} subtitle={t("push.device.subtitle")}>
            <PhoneNotifications role={user.role === "designer" ? "designer" : "client"} />
          </Section>
          <Section title={t("settings.password.title")}>
            <PasswordForm min={s["auth.password_min_length"]} />
          </Section>
          {user.role === "designer" && (
            <Section id="portfolio" title={t("portfolio.title")} subtitle={t("portfolio.subtitle")}>
              <PortfolioForm
                skills={(profile?.skills ?? []) as string[]}
                tools={(profile?.tools ?? []) as string[]}
                experienceYears={(profile?.experience_years as number | null) ?? null}
                extras={
                  extrasRes.error || !extrasRes.data
                    ? null
                    : {
                        languages: (extrasRes.data.languages as string[] | null) ?? [],
                        skillLevels: (extrasRes.data.skill_levels as Record<string, string> | null) ?? {},
                        toolYears: (extrasRes.data.tool_years as Record<string, number> | null) ?? {},
                      }
                }
              />
            </Section>
          )}
        </div>;
  return bare ? content : (
    <Panel tone="grey" className="max-[720px]:py-4">
      {content}
    </Panel>
  );
}

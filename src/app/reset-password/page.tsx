import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.reset.newTitle"), robots: { index: false } };
}

// "Set a new password", reached from the emailed reset link (/auth/confirm signs the user in).
export default async function ResetPasswordPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  return (
    <AuthCard icon="key" title={t("auth.reset.newTitle")} subtitle={user ? t("auth.reset.newSubtitle") : undefined}>
      {user ? (
        <NewPasswordForm passwordMin={await getSetting("auth.password_min_length")} />
      ) : (
        <div className="space-y-4">
          <p className="text-muted">{t("auth.errors.resetExpired")}</p>
          <ButtonLink href="/forgot-password" size="lg" block>
            {t("auth.reset.askAgain")}
          </ButtonLink>
        </div>
      )}
    </AuthCard>
  );
}

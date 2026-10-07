import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.verify.pageTitle"), robots: { index: false } };
}

// Enter the emailed code. The welcome push notification opens this page.
export default async function VerifyEmailPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect("/login?next=/verify-email");

  if (!user.email || user.emailVerifiedAt) {
    return (
      <AuthCard title={t("auth.verify.okTitle")} subtitle={t("auth.verify.okBody")}>
        <ButtonLink href="/" size="lg" block>
          {t("notFound.home")}
        </ButtonLink>
      </AuthCard>
    );
  }

  const length = await getSetting("auth.email_code_length");
  return (
    <AuthCard title={t("auth.verify.pageTitle")} subtitle={t("auth.verify.pageSubtitle", { email: user.email, length })}>
      <EmailCodeForm length={length} variant="page" />
    </AuthCard>
  );
}

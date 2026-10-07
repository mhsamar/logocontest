import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetFlow } from "@/components/auth/reset-flow";
import { getSetting } from "@/lib/settings";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.reset.title"), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <AuthCard
      title={t("auth.reset.title")}
      subtitle={t("auth.reset.subtitle")}
      footer={
        <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-primary-dark hover:underline">
          {t("auth.reset.back")}
        </Link>
      }
    >
      <ResetFlow passwordMin={await getSetting("auth.password_min_length")} />
    </AuthCard>
  );
}

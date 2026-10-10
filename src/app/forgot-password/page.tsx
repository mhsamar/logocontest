import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.reset.title"), robots: { index: false } };
}

// P-11 "Forgot password?": the reset link is emailed (owner, 2026-10-07).
export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const { expired } = await searchParams;
  const { t } = await getI18n();
  return (
    <AuthCard
      icon="key"
      title={t("auth.reset.title")}
      subtitle={t("auth.reset.subtitle")}
      footer={
        <Link href="/login" className="inline-flex min-h-11 items-center font-bold text-primary hover:underline">
          {t("auth.reset.back")}
        </Link>
      }
    >
      <ForgotPasswordForm expired={expired === "1"} />
    </AuthCard>
  );
}

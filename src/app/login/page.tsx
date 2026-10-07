import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.login.title"), robots: { index: false } };
}

// P-11
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/");
  const { t } = await getI18n();
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <AuthCard
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center sm:gap-6">
          <Link href="/start" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
            {t("auth.login.wantLogo")}
          </Link>
          <Link href="/designers" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
            {t("auth.login.imDesigner")}
          </Link>
        </div>
      }
    >
      <LoginForm next={nextPath} />
    </AuthCard>
  );
}

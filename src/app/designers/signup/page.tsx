import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { DesignerSignupFlow } from "@/components/designers/signup-flow";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("designerSignup.meta.title") };
}

// D-01 Designer sign-up
export default async function DesignerSignupPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  // Signed-in people already have an account (one account = one role).
  if (user) redirect(user.role === "designer" ? "/contests" : "/dashboard");
  const s = await getSettings(["auth.password_min_length", "limits.designer_bio_max_length"]);

  return (
    <AuthCard
      title={t("designerSignup.title")}
      subtitle={t("designerSignup.subtitle")}
      footer={
        <>
          {t("designerSignup.wantLogo")}{" "}
          <Link href="/start" className="font-semibold text-primary hover:underline">
            {t("designerSignup.startContest")}
          </Link>
        </>
      }
    >
      <DesignerSignupFlow passwordMin={s["auth.password_min_length"]} bioMax={s["limits.designer_bio_max_length"]} />
    </AuthCard>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLockup, DoorIllustration, DoorLanguage } from "@/components/admin/doors";
import { AdminIcon } from "@/components/admin/icons";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.login.adminTitle"), robots: { index: false, follow: false } };
}

// Admin sign-in (owner, 2026-10-10): its own full page, the picture on one side and the form on the other.
export default async function AdminLoginPage({ searchParams }: PageProps<"/admin-login">) {
  const sp = await searchParams;
  const asked = typeof sp.next === "string" ? sp.next : "";
  // Only admin pages are a place to go back to from here.
  const next = asked === "/admin" || asked.startsWith("/admin/") ? asked : "/admin";
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (can(user, "admin.access")) redirect(next);

  return (
    <div className="flex min-h-dvh bg-surface text-ink">
      {/* Picture side (computers only) */}
      <div className="relative hidden flex-1 flex-col overflow-hidden bg-adm-bg lg:flex">
        <div className="relative z-10 p-8">
          <Link href="/" aria-label={t("admin.doors.toSite")}>
            <AdminLockup />
          </Link>
        </div>
        <div className="relative z-10 flex flex-1 items-center px-10 pb-24">
          <DoorIllustration />
        </div>
        <svg aria-hidden viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[34%] w-full text-[#ecedf0]">
          <path d="M0 300V140C150 40 300 20 520 32S880 70 1000 60V300Z" fill="currentColor" />
        </svg>
      </div>

      {/* Form side */}
      <div className="flex w-full flex-col px-5 py-6 sm:px-10 lg:w-[540px] lg:shrink-0 lg:px-14 xl:w-[600px]">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="lg:invisible" aria-label={t("admin.doors.toSite")}>
            <AdminLockup />
          </Link>
          <DoorLanguage />
        </div>

        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10">
          <span className="mb-5 flex size-14 items-center justify-center rounded-[16px] bg-[image:var(--gradient-red-icon)] text-white shadow-[var(--shadow-glow)]">
            <AdminIcon name="team" size={26} />
          </span>
          <h1 className="m-0 text-[clamp(28px,3vw,34px)] font-semibold leading-[1.1] tracking-[-0.035em]">
            {t("admin.doors.welcome")} <span aria-hidden>👋</span>
          </h1>
          <p className="m-0 mt-2 text-[17px] text-muted">{t("admin.doors.welcomeLead")}</p>

          {user && (
            <div className="mt-5">
              <Alert tone="warning">{t("admin.doors.notAdmin", { name: user.name })}</Alert>
            </div>
          )}
          {!isSupabaseConfigured() && (
            <div className="mt-5">
              <Alert tone="warning">{t("auth.errors.notConfigured")}</Alert>
            </div>
          )}

          <div className="mt-7">
            <LoginForm next={next} />
          </div>

          <div className="my-6 flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-adm-line" />
            {t("admin.doors.or")}
            <span className="h-px flex-1 bg-adm-line" />
          </div>
          <Link href="/" className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] border border-adm-line text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
            {t("admin.doors.toSite")}
            <AdminIcon name="arrow" size={16} />
          </Link>
        </div>

        <p className="m-0 flex items-center justify-center gap-2 text-center text-[13.5px] text-muted">
          <AdminIcon name="checker" size={15} />
          {t("admin.doors.private")}
        </p>
      </div>
    </div>
  );
}

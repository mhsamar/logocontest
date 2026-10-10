import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLockup, DoorLanguage } from "@/components/admin/doors";
import { AdminIcon } from "@/components/admin/icons";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.doors.signedOut"), robots: { index: false, follow: false } };
}

/** A cup of cha, steaming: the signed-out picture, drawn in the brand colours. */
function TeaCup() {
  return (
    <svg aria-hidden viewBox="0 0 160 150" className="h-[150px] w-[160px]">
      <g fill="none" strokeLinecap="round" strokeWidth="5">
        <path d="M58 14c-6 8 6 14 0 24M80 8c-6 9 6 16 0 27M102 14c-6 8 6 14 0 24" stroke="var(--color-adm-pay)" />
        <path d="M30 58h88v40a30 30 0 0 1-30 30H60a30 30 0 0 1-30-30z" stroke="var(--color-ink)" strokeLinejoin="round" />
        <path d="M118 68h8a16 16 0 0 1 0 32h-9" stroke="var(--color-ink)" />
        <path d="M18 138h124" stroke="var(--color-ink)" />
        <path d="M74 58v18" stroke="var(--color-primary)" strokeWidth="3" />
        <rect x="66" y="76" width="16" height="18" rx="3" stroke="var(--color-primary)" strokeWidth="4" />
      </g>
    </svg>
  );
}

// Admin signed out (owner, 2026-10-10): a thank-you card with Sign in again.
export default async function AdminSignedOutPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  // Still signed in as an admin (for example after pressing Back): straight back to the panel.
  if (can(user, "admin.access")) redirect("/admin");
  const year = new Date().getFullYear();

  return (
    <div className="relative flex min-h-dvh flex-col bg-adm-bg text-ink">
      {/* Red band with a curved edge */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[380px] overflow-hidden bg-[image:var(--gradient-red-dark)] sm:h-[420px]">
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[110px] w-full text-adm-bg">
          <path d="M0 200V60C250 140 750 140 1000 60V200Z" fill="currentColor" />
        </svg>
        <span className="absolute -left-16 top-10 size-64 rounded-full bg-white/[0.06]" />
        <span className="absolute -right-10 top-24 size-44 rounded-full bg-white/[0.06]" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <span className="max-sm:hidden" />
        <DoorLanguage light />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center px-4 pb-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <Link href="/" aria-label={t("admin.doors.toSite")}>
            <AdminLockup light />
          </Link>
          <p className="m-0 text-[15.5px] text-white/75">{t("admin.doors.panelLine")}</p>
        </div>

        <div className="mt-10 flex w-full max-w-[520px] flex-col items-center rounded-[20px] border border-adm-line bg-surface px-6 py-10 text-center shadow-[0_24px_60px_rgb(17_18_22/0.12)] sm:px-10">
          <TeaCup />
          <h1 className="m-0 mt-8 text-[clamp(24px,3vw,30px)] font-semibold tracking-[-0.03em]">{t("admin.doors.signedOut")}</h1>
          <p className="m-0 mt-2 max-w-sm text-[16.5px] text-muted">{t("admin.doors.thanks")}</p>
          <Link href="/admin-login" className="mt-8 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[image:var(--gradient-red)] text-[17px] font-bold text-white shadow-[var(--shadow-glow)] hover:brightness-110">
            <AdminIcon name="team" size={18} />
            {t("admin.doors.signInAgain")}
          </Link>
          <Link href="/" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-adm-strong hover:text-primary">
            {t("admin.doors.toSite")}
            <AdminIcon name="arrow" size={16} />
          </Link>
        </div>
      </div>

      <p className="relative z-10 m-0 pb-6 text-center text-sm text-muted">{t("admin.doors.footer", { year })}</p>
    </div>
  );
}

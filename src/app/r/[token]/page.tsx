import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResumeButton } from "@/components/contests/resume-button";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { getCurrentUser } from "@/lib/auth/session";
import { resumeSecret, resumeTarget } from "@/lib/contests/resume";
import { resumeContest } from "@/lib/contests/resume-actions";
import { readResumeToken } from "@/lib/contests/resume-token";
import { getI18n } from "@/lib/i18n/server";
import { formatMobile } from "@/lib/phone";
import { openGraphFor } from "@/lib/seo";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  // WhatsApp shows this in the link's preview: nothing about the contest, and no address (the link is the key).
  const meta = { title: t("resume.meta"), description: t("resume.metaDescription") };
  return { ...meta, openGraph: openGraphFor({ ...meta, locale }), robots: { index: false, follow: false } };
}

/**
 * A client's resume-contest link (owner, 2026-10-26; sent from Admin › Unpaid contests and in the reminder emails).
 * The client who is already signed in goes straight to their draft; anyone else gets one "Continue my contest"
 * button, which signs the client in (never on opening the page: link previews and email scanners open it too).
 */
export default async function ResumePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ failed?: string }> }) {
  const [{ token }, sp, { t }, s] = await Promise.all([params, searchParams, getI18n(), getSettings(["contact.phone", "security.resume_link_days"])]);
  const read = readResumeToken(resumeSecret(), token);
  const target = read ? await resumeTarget(read.contestId) : null;
  const me = target ? await getCurrentUser() : null;
  if (target && me?.id === target.clientId) redirect(target.href);
  const phone = formatMobile(s["contact.phone"]) || s["contact.phone"];

  return (
    <PageShell>
      <Panel tone="grey" className="flex flex-1 items-start justify-center">
        <div className="lc-card w-full max-w-lg space-y-4 p-6 sm:p-8">
          {target ? (
            <>
              <h1 className="m-0 text-[24px] font-semibold tracking-[-0.02em] text-ink">{t("resume.title")}</h1>
              <p className="m-0 text-[16px] leading-relaxed text-ink">{t("resume.body", { brand: target.brand })}</p>
              {sp.failed && <Alert tone="danger">{t("resume.failed", { phone })}</Alert>}
              {me?.role === "admin" ? (
                <Alert tone="info">{t("resume.staff")}</Alert>
              ) : (
                <form action={resumeContest.bind(null, token)} className="space-y-2">
                  <ResumeButton label={t("resume.button")} />
                  {me && <p className="m-0 text-center text-[13px] text-muted">{t("resume.switching")}</p>}
                </form>
              )}
            </>
          ) : (
            <>
              <h1 className="m-0 text-[24px] font-semibold tracking-[-0.02em] text-ink">{t("resume.expiredTitle")}</h1>
              <p className="m-0 text-[16px] leading-relaxed text-ink">{t("resume.expiredBody", { days: s["security.resume_link_days"], phone })}</p>
              <ButtonLink href="/login?as=client&next=%2Fclient%2Fcontests" size="lg" block>
                {t("resume.login")}
              </ButtonLink>
            </>
          )}
        </div>
      </Panel>
    </PageShell>
  );
}

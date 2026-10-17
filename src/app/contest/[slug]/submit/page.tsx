import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SubmitForm } from "@/components/entries/submit-form";
import { ButtonLink } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { agreementOk } from "@/lib/agreements/queries";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { getContestBySlug } from "@/lib/contests/browse";
import { contestVisibleTo } from "@/lib/pro/limits";
import { getI18n } from "@/lib/i18n/server";
import { suspendedError } from "@/lib/moderation/suspension";
import { getSetting } from "@/lib/settings";
import { ServiceBrief } from "@/components/services/service-brief";
import { getService } from "@/lib/services/store";
import { isLogo } from "@/lib/services/types";
import { sendCheckSetup } from "@/lib/logo-check/entry-check";
import { getProSettings, proFeatureOn } from "@/lib/pro/settings";
import { isPro } from "@/lib/pro/status";
import { mockupLimit } from "@/lib/entries/limits";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("submit.metaTitle"), robots: { index: false } };
}

// D-04 Submit a design (UI-JOURNEY, owner 2026-10-08)
export default async function SubmitDesignPage({ params }: PageProps<"/contest/[slug]/submit">) {
  const { slug } = await params;
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect(`/login?as=designer&next=${encodeURIComponent(`/contest/${slug}/submit`)}`);
  const contest = await getContestBySlug(slug, user);
  if (!contest) notFound();
  // Pro early access (owner, 2026-10-13): the contest page says when it opens to everyone.
  if (contest.status === "open" && !(await contestVisibleTo(contest.startsAt, user))) redirect(`/contest/${slug}`);
  // A suspended designer can't send a new design until the suspension ends (owner, 2026-10-12); they hear it first.
  const held = user.role === "designer" ? suspendedError(user) : null;
  // NDA contests: the confidentiality agreement comes first, on the contest page (owner, 2026-10-08).
  if (!held && contest.isNda && !contest.canSeeBrief) redirect(`/contest/${slug}?tab=brief`);
  // The originality agreement comes before the first design (BLUEPRINT §9.6, owner 2026-10-09), while it is switched on
  // in Admin → Agreements (owner, 2026-10-13: off by default).
  if (!held && user.role === "designer" && !(await agreementOk(user.id))) redirect(`/dashboard/agreement?next=${encodeURIComponent(`/contest/${slug}/submit`)}`);

  const open = contest.status === "open" && (!contest.endsAt || contest.endsAt > new Date());
  // A designer confirms their email before sending designs (owner, 2026-10-14).
  const unverified = user.role === "designer" && Boolean(user.email) && !user.emailVerifiedAt;
  const blocked = held ? "suspended" : !can(user, "entry.submit") ? "designersOnly" : !open ? "closed" : unverified ? "emailUnverified" : null;

  const [min, siteMax, px, siteMb, deliverDays] = await Promise.all([
    getSetting("limits.entry_min_images"),
    // Basic and Pro each have their own number (owner, 2026-10-14: Admin › Settings).
    user.role === "designer" ? mockupLimit(user.id) : getSetting("limits.entry_max_images"),
    getSetting("limits.entry_image_min_px"),
    getSetting("limits.entry_image_max_mb"),
    getSetting("timers.designer_file_upload_days"),
  ]);
  // A non-logo contest (owner, 2026-10-13): its own upload limits, and what to make, shown above the form.
  const svc = isLogo(contest.service) ? null : await getService(contest.service);
  const max = svc ? Math.min(siteMax, svc.maxImages) : siteMax;
  // Logo check before sending (owner, 2026-10-14): logo contests only, like the client's checker.
  const check = !blocked && user.role === "designer" && isLogo(contest.service) ? await Promise.all([sendCheckSetup(user), getProSettings()]).then(([s, p]) => ({ ready: s.ready, usage: s.usage, priceBdt: s.priceBdt, proLogoChecks: p.settings.proLogoChecks })) : null;
  const mb = svc ? svc.maxMb : siteMb;
  // Pro "Hide my design" (owner, 2026-10-14): Pro designers can send a design only the client sees.
  const canHide = !blocked && user.role === "designer" && (await proFeatureOn("hidden_entries")) && (await isPro(user.id));

  return (
    <PageShell>
      <BackLink href={`/contest/${contest.slug}`}>{contest.canSeeBrief ? contest.brandName : t("contest.privateTitle")}</BackLink>
      <Panel as="header" className="max-[720px]:py-6">
        <PageTitle pill={t("submit.for", { brand: contest.canSeeBrief ? contest.brandName : t("contest.privateTitle") })} lead={t("submit.title")} />
      </Panel>
      <Panel tone="grey" className="flex-1 max-[720px]:py-4">
        <div className="mx-auto w-full max-w-3xl">
          {blocked ? (
            <EmptyState
              title={blocked === "suspended" ? t("suspension.title") : t(`submit.${blocked}.title`)}
              body={held ? t(held.key, held.params) : blocked === "emailUnverified" ? t("submit.emailUnverified.body", { email: user.email ?? "" }) : t(`submit.${blocked as "designersOnly" | "closed"}.body`)}
              action={blocked === "emailUnverified" ? <ButtonLink href="/verify-email">{t("submit.emailUnverified.action")}</ButtonLink> : <ButtonLink href={`/contest/${contest.slug}`}>{t("submit.back")}</ButtonLink>}
            />
          ) : (
            <>
              {svc && contest.brief && (
                <div className="mb-5">
                  <ServiceBrief service={svc} answers={contest.serviceBrief} full files={contest.brief?.files ?? []} hidden={contest.hiddenPrivate} />
                </div>
              )}
              <SubmitForm contestId={contest.id} slug={contest.slug} contestName={contest.canSeeBrief ? contest.brandName : t("contest.privateTitle")} check={check} canHide={canHide} limits={{ min, max, px, mb, deliverDays, size: svc && svc.width > 0 && svc.height > 0 ? { w: svc.width, h: svc.height } : null }} />
            </>
          )}
        </div>
      </Panel>
    </PageShell>
  );
}

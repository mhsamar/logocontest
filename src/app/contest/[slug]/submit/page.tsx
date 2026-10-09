import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SubmitForm } from "@/components/entries/submit-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hasSignedAgreement } from "@/lib/agreements/queries";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { getContestBySlug } from "@/lib/contests/browse";
import { getI18n } from "@/lib/i18n/server";
import { getSetting } from "@/lib/settings";

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
  // NDA contests: the confidentiality agreement comes first, on the contest page (owner, 2026-10-08).
  if (contest.isNda && !contest.canSeeBrief) redirect(`/contest/${slug}?tab=brief`);
  // The originality agreement comes before the first design (BLUEPRINT §9.6, owner 2026-10-09).
  if (user.role === "designer" && !(await hasSignedAgreement(user.id))) redirect(`/dashboard/agreement?next=${encodeURIComponent(`/contest/${slug}/submit`)}`);

  const open = contest.status === "open" && (!contest.endsAt || contest.endsAt > new Date());
  const blocked = !can(user, "entry.submit") ? "designersOnly" : !open ? "closed" : null;

  const [min, max, px, mb] = await Promise.all([
    getSetting("limits.entry_min_images"),
    getSetting("limits.entry_max_images"),
    getSetting("limits.entry_image_min_px"),
    getSetting("limits.entry_image_max_mb"),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:pt-10">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{t("submit.for", { brand: contest.canSeeBrief ? contest.brandName : t("contest.privateTitle") })}</p>
      <h1 className="mt-2 text-h1 font-bold tracking-tight text-ink lg:text-h1-lg">{t("submit.title")}</h1>

      <div className="mt-6">
        {blocked ? (
          <EmptyState
            title={t(`submit.${blocked}.title`)}
            body={t(`submit.${blocked}.body`)}
            action={<ButtonLink href={`/contest/${contest.slug}`}>{t("submit.back")}</ButtonLink>}
          />
        ) : (
          <SubmitForm contestId={contest.id} slug={contest.slug} limits={{ min, max: Math.min(max, 8), px, mb }} />
        )}
      </div>
    </div>
  );
}

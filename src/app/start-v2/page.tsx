import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WizardV2, type WizardV2Props } from "@/components/wizard-v2/wizard-v2";
import { getCurrentUser } from "@/lib/auth/session";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { contestRepository } from "@/lib/contests/services";
import { visibleList } from "@/lib/content/lists";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { onboardingV2On, v2StartStep } from "@/lib/onboarding/v2-steps";
import { awaitingApproval } from "@/lib/payments/manual";
import { getService } from "@/lib/services/store";
import { LOGO } from "@/lib/services/types";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappLink } from "@/lib/site";
import { cannotStart, ComingSoon } from "../start/start-flow";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("wizardV2.meta.title"), robots: { index: false } };
}

/**
 * Onboarding v2 (owner, 2026-10-28; client-onboarding-v2-spec.md): a logo contest in 4 steps (account, logo name and
 * business type, prize, bKash payment), with the rest of the brief after paying. Only while ONBOARDING_V2=true; the
 * old /start stays until the owner approves. ?draft= reopens one of the client's v2 contests at its step; without it a
 * signed-in client carries on with their newest unpaid one.
 */
export default async function StartV2Page({ searchParams }: PageProps<"/start-v2">) {
  if (!onboardingV2On()) notFound();
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  const blocked = await cannotStart(user);
  if (blocked) return blocked;
  const logo = await getService(LOGO);
  if (logo && !logo.on) return <ComingSoon service={logo} />;

  const { t } = await getI18n();
  const [pricing, s, types] = await Promise.all([
    getPricingConfig(),
    getSettings(["auth.password_min_length", "onboarding.approval_minutes", "contact.whatsapp"]),
    visibleList("business_types", "en"),
  ]);

  let resume: WizardV2Props["resume"] = null;
  if (user && isSupabaseConfigured()) {
    const wanted = typeof params.new === "string" ? null : typeof params.draft === "string" ? params.draft : undefined;
    const mine = (await contestRepository().listByClient(user.id)).filter((c) => c.briefCompletion && (c.status === "draft" || c.status === "pending_payment"));
    // The asked-for draft, or the newest unpaid one ("start a new contest" passes ?new).
    const draft = wanted === undefined ? mine[0] : wanted ? mine.find((c) => c.id === wanted) : undefined;
    if (draft) {
      const [waiting, { data: row }] = await Promise.all([
        awaitingApproval([draft.id]),
        createAdminClient().from("contests").select("last_step, content_rules_agreed_at").eq("id", draft.id).maybeSingle(),
      ]);
      resume = {
        contestId: draft.id,
        slug: draft.slug,
        brandName: draft.brief.brandName,
        businessType: draft.brief.businessType,
        businessTypeOther: draft.brief.businessTypeOther ?? "",
        order: draft.order,
        lastStep: (row?.last_step as number | null) ?? null,
        agreed: Boolean(row?.content_rules_agreed_at),
        waiting: waiting.has(draft.id),
      };
    }
  }

  return (
    <WizardV2
      signedIn={Boolean(user)}
      pricing={pricing}
      passwordMin={s["auth.password_min_length"]}
      approvalMinutes={s["onboarding.approval_minutes"]}
      whatsapp={whatsappLink(s["contact.whatsapp"], t("wizardV2.prize.whatsapp"))}
      businessTypes={types.map((b) => b.id)}
      resume={resume}
      initialStep={v2StartStep({ signedIn: Boolean(user), contest: resume ? { lastStep: resume.lastStep, waiting: resume.waiting } : null })}
    />
  );
}

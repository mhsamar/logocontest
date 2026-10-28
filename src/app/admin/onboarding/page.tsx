import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { OnboardingEditor, type EditorQuestion } from "@/components/admin/onboarding-editor";
import { AdminHead } from "@/components/admin/page-head";
import { requirePermission } from "@/lib/admin/core";
import { flattenTexts, type TextTree } from "@/lib/content/rules";
import { getMessages } from "@/lib/content/texts";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { FLOWS, type OnboardingFlow } from "@/lib/onboarding/config";
import { getOnboarding } from "@/lib/onboarding/store";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.onboarding.title"), robots: { index: false } };
}

// Admin › Onboarding (owner, 2026-10-14): the questions new clients and designers answer, hidden, reworded or added.
export default async function AdminOnboardingPage({ searchParams }: PageProps<"/admin/onboarding">) {
  await requirePermission("content.view");
  const sp = await searchParams;
  const flow: OnboardingFlow = sp.flow === "designer" ? "designer" : "client";
  const [{ t, locale }, cfg, en, bn] = await Promise.all([getI18n(), getOnboarding(flow), getMessages("en"), getMessages("bn")]);
  const texts = { en: flattenTexts(en as unknown as TextTree), bn: flattenTexts(bn as unknown as TextTree) };
  const shown = locale === "bn" ? texts.bn : texts.en;
  const def = FLOWS[flow];
  // The question's own label: its "…Label"/"label" text when it has one, otherwise its first text.
  const labelOf = (keys: string[]) => shown[keys.find((k) => /label$/i.test(k)) ?? keys[0]] ?? keys[0];
  const questions: EditorQuestion[] = def.questions.map((q) => ({
    key: q.key,
    step: q.step,
    hideable: q.hideable,
    label: labelOf(q.texts),
    texts: q.texts.map((k) => ({ key: k, en: texts.en[k] ?? "", bn: texts.bn[k] ?? "" })),
  }));
  const steps = def.steps.map((s) => ({ step: s.step, title: shown[s.title] ?? s.title }));
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={t("admin.onboarding.title")} lead={t("admin.onboarding.lead")} />
      <nav aria-label={t("admin.onboarding.title")}>
        <ul className="m-0 flex w-max list-none gap-1 rounded-[14px] border border-adm-line bg-surface p-1">
          {(["client", "designer"] as const).map((f) => (
            <li key={f}>
              <Link href={`/admin/onboarding?flow=${f}`} aria-current={f === flow ? "page" : undefined} className={cx("flex min-h-10 items-center rounded-[10px] px-4 text-[14.5px] font-semibold", f === flow ? "bg-ink text-white" : "text-adm-strong hover:bg-adm-bg")}>
                {t(`admin.onboarding.flows.${f}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <OnboardingEditor key={`${flow}:${JSON.stringify(cfg)}`} flow={flow} steps={steps} questions={questions} initial={cfg} extraSteps={def.extraSteps} />
    </div>
  );
}

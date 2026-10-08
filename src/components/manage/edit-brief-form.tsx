"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BrandStep, BusinessStep, ColorsStep, RequirementsStep, StylesStep, WebsiteStep } from "@/components/wizard/steps-brief";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Brief, FieldErrors } from "@/lib/contests/brief";
import { saveContestBrief } from "@/lib/contests/edit-actions";
import { useI18n } from "@/lib/i18n/client";

const STEPS = [
  { key: "c01", Step: BrandStep },
  { key: "c02", Step: BusinessStep },
  { key: "c03", Step: WebsiteStep },
  { key: "c04", Step: StylesStep },
  { key: "c05", Step: ColorsStep },
  { key: "c06", Step: RequirementsStep },
] as const;

/** C-13b Edit details (owner, 2026-10-08): the wizard's brief fields on one page; saving tells the designers. */
export function EditBriefForm({ contestId, initial, backHref }: { contestId: string; initial: Brief; backHref: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [brief, setBrief] = useState<Brief>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const update = (patch: Partial<Brief>) => setBrief((b) => ({ ...b, ...patch }));
  const touch = (field: string) => setTouched((s) => new Set(s).add(field));

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveContestBrief(contestId, brief);
      if (!res.ok) {
        if (res.errors) {
          setErrors(res.errors);
          setTouched(new Set(Object.keys(res.errors)));
          setError(t("manage.edit.fix"));
        } else if (res.error) setError(t(res.error));
        return;
      }
      toast(t("manage.edit.saved"));
      router.push(backHref);
    });

  return (
    <div className="space-y-5">
      {STEPS.map(({ key, Step }, i) => (
        <section key={key} className="animate-rise rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6" style={{ animationDelay: `${i * 60}ms` }}>
          <h2 className="mb-4 text-lg font-bold text-ink">{t(`wizard.${key}.heading`)}</h2>
          <Step brief={brief} update={update} errors={errors} touched={touched} touch={touch} />
        </section>
      ))}
      <div className="sticky bottom-3 z-10 rounded-2xl bg-white/90 p-3 shadow-raised ring-1 ring-line backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-muted">{t("manage.edit.notice")}</p>
        <div className="mt-2 flex shrink-0 gap-2 sm:mt-0">
          <ButtonLink href={backHref} variant="secondary">
            {t("common.cancel")}
          </ButtonLink>
          <Button onClick={save} loading={busy}>
            {t("manage.edit.save")}
          </Button>
        </div>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { EXPERIENCE_MAX, OTHER_MAX, SKILLS, TOOLS, isSkillKey, isToolKey } from "@/lib/designers/portfolio-options";
import { useI18n } from "@/lib/i18n/client";
import { savePortfolio, type SettingsState } from "@/lib/profile/actions";

/** A tappable chip that is really a checkbox, so it works without JavaScript. */
function Chip({ name, value, label, defaultChecked }: { name: string; value: string; label: string; defaultChecked: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <label
      className={cx(
        "inline-flex min-h-10 cursor-pointer select-none items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 transition-colors",
        on ? "bg-primary text-white ring-primary" : "bg-surface text-ink ring-line hover:ring-primary",
      )}
    >
      <input type="checkbox" name={name} value={value} checked={on} onChange={(e) => setOn(e.target.checked)} className="sr-only" />
      {on && (
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {label}
    </label>
  );
}

/** D-12 Portfolio (owner, 2026-10-08): experience, skills and tools for the public profile and PDF. */
export function PortfolioForm({ skills, tools, experienceYears }: { skills: string[]; tools: string[]; experienceYears: number | null }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, action, pending] = useActionState<SettingsState, FormData>(savePortfolio, { status: "idle" });
  useEffect(() => {
    if (state.status === "ok") toast(t("settings.saved"));
  }, [state, toast, t]);
  const err = (field: string) => (state.status === "error" && state.field === field && state.error ? t(state.error.key, state.error.params) : undefined);
  const otherSkill = skills.find((s) => !isSkillKey(s)) ?? "";
  const otherTool = tools.find((s) => !isToolKey(s)) ?? "";

  return (
    <form action={action} className="space-y-6">
      <div className="max-w-xs">
        <TextField
          name="experienceYears"
          type="number"
          inputMode="numeric"
          min={0}
          max={EXPERIENCE_MAX}
          label={t("portfolio.experience")}
          hint={t("portfolio.experienceHint")}
          defaultValue={experienceYears ?? ""}
          error={err("experienceYears")}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">{t("portfolio.skillsTitle")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SKILLS.map((k) => (
            <Chip key={k} name="skills" value={k} label={t(`portfolio.skills.${k}`)} defaultChecked={skills.includes(k)} />
          ))}
        </div>
        <div className="mt-3 max-w-sm">
          <TextField name="otherSkill" label={t("portfolio.otherSkill")} hint={t("portfolio.otherHint", { max: OTHER_MAX })} maxLength={OTHER_MAX} defaultValue={otherSkill} error={err("otherSkill")} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-ink">{t("portfolio.toolsTitle")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOOLS.map((k) => (
            <Chip key={k} name="tools" value={k} label={t(`portfolio.tools.${k}`)} defaultChecked={tools.includes(k)} />
          ))}
        </div>
        <div className="mt-3 max-w-sm">
          <TextField name="otherTool" label={t("portfolio.otherTool")} hint={t("portfolio.otherHint", { max: OTHER_MAX })} maxLength={OTHER_MAX} defaultValue={otherTool} error={err("otherTool")} />
        </div>
      </fieldset>

      {state.status === "error" && !state.field && state.error && <p className="text-sm text-danger">{t(state.error.key, state.error.params)}</p>}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {t("portfolio.save")}
        </Button>
      </div>
    </form>
  );
}

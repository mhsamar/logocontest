"use client";

import { useActionState, useEffect, useState } from "react";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { EXPERIENCE_MAX, isLanguageKey, isSkillKey, isToolKey, LANGUAGES, OTHER_MAX, SKILL_LEVELS, SKILLS, SKILLS_MAX, TOOLS } from "@/lib/designers/portfolio-options";
import { useI18n } from "@/lib/i18n/client";
import { savePortfolio, type SettingsState } from "@/lib/profile/actions";
import { SaveButton, useUnsaved } from "./save-button";

/** A tappable chip that is really a checkbox, so it works without JavaScript. */
function Chip({ name, value, label, checked, onChange, disabled = false }: { name: string; value: string; label: string; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <label
      className={cx(
        "inline-flex min-h-10 select-none items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 transition-colors",
        checked ? "cursor-pointer bg-primary text-white ring-primary" : disabled ? "cursor-not-allowed bg-surface text-muted opacity-50 ring-line" : "cursor-pointer bg-surface text-ink ring-line hover:ring-primary",
      )}
    >
      <input type="checkbox" name={name} value={value} checked={checked} disabled={disabled && !checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      {checked && (
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {label}
    </label>
  );
}

type Extras = { languages: string[]; skillLevels: Record<string, string>; toolYears: Record<string, number> };
const SELECT = "min-h-10 rounded-[10px] border border-line bg-surface px-2.5 text-sm font-medium text-ink focus:outline-2 focus:outline-primary";

/**
 * D-12 Portfolio (owner, 2026-10-08): experience, skills and tools for the public profile and PDF. Profile redesign
 * (owner, 2026-10-12; migration 0042): optional languages, a level per skill (shown as bars, up to 5) and years per
 * tool. Those only show once the database has them (`extras` is null before).
 */
export function PortfolioForm({ skills, tools, experienceYears, extras }: { skills: string[]; tools: string[]; experienceYears: number | null; extras: Extras | null }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, action, pending] = useActionState<SettingsState, FormData>(savePortfolio, { status: "idle" });
  const { unsaved, changed } = useUnsaved(state);
  useEffect(() => {
    if (state.status === "ok") toast(t("settings.saved"));
  }, [state, toast, t]);
  const err = (field: string) => (state.status === "error" && state.field === field && state.error ? t(state.error.key, state.error.params) : undefined);
  const otherSkillStart = skills.find((s) => !isSkillKey(s)) ?? "";
  const otherToolStart = tools.find((s) => !isToolKey(s)) ?? "";
  const [pickedSkills, setPickedSkills] = useState(() => new Set<string>(skills.filter(isSkillKey)));
  const [pickedTools, setPickedTools] = useState(() => new Set<string>(tools.filter(isToolKey)));
  const [pickedLangs, setPickedLangs] = useState(() => new Set<string>((extras?.languages ?? []).filter(isLanguageKey)));
  const [otherSkill, setOtherSkill] = useState(otherSkillStart);
  const [otherTool, setOtherTool] = useState(otherToolStart);
  // Every field is controlled (owner, 2026-10-15): the form resets itself after each save, and a field that only had a
  // starting value went blank then, so the next save wiped it (the years of experience "vanished").
  const [years, setYears] = useState(experienceYears === null ? "" : String(experienceYears));
  const [otherLanguage, setOtherLanguage] = useState((extras?.languages ?? []).find((l) => !isLanguageKey(l)) ?? "");
  const [levels, setLevels] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(extras?.skillLevels ?? {})) out[isSkillKey(k) ? k : "other"] = v;
    return out;
  });
  const [toolYears, setToolYears] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(extras?.toolYears ?? {})) out[isToolKey(k) ? k : "other"] = String(v);
    return out;
  });
  // At most SKILLS_MAX skills, the "other" one included (owner, 2026-10-14).
  const skillCount = pickedSkills.size + (otherSkill.trim() ? 1 : 0);
  const skillsFull = skillCount >= SKILLS_MAX;
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, k: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(k);
    else next.delete(k);
    setter(next);
  };

  // A level for each picked skill (and the "other" one), years for each picked tool.
  const levelRows = [...SKILLS.filter((k) => pickedSkills.has(k)).map((k) => ({ key: k as string, label: t(`portfolio.skills.${k}`) })), ...(otherSkill.trim() ? [{ key: "other", label: otherSkill.trim() }] : [])];
  const yearRows = [...TOOLS.filter((k) => pickedTools.has(k)).map((k) => ({ key: k as string, label: t(`portfolio.tools.${k}`) })), ...(otherTool.trim() ? [{ key: "other", label: otherTool.trim() }] : [])];
  const yearsError = yearRows.map((r) => err(`years_${r.key}`)).find(Boolean);

  return (
    <form action={action} onChange={changed} className="space-y-6">
      {extras && <input type="hidden" name="extras" value="1" />}
      <div className="max-w-xs">
        <TextField
          name="experienceYears"
          type="number"
          inputMode="numeric"
          min={0}
          max={EXPERIENCE_MAX}
          label={t("portfolio.experience")}
          hint={t("portfolio.experienceHint")}
          value={years}
          onChange={(e) => setYears(e.target.value)}
          error={err("experienceYears")}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">{t("portfolio.skillsTitle")}</legend>
        <p className={cx("m-0 mt-0.5 text-sm", skillsFull ? "font-semibold text-primary" : "text-muted")}>{t("portfolio.skillsHint", { max: SKILLS_MAX, n: skillCount })}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SKILLS.map((k) => (
            <Chip key={k} name="skills" value={k} label={t(`portfolio.skills.${k}`)} checked={pickedSkills.has(k)} disabled={skillsFull} onChange={(on) => toggle(pickedSkills, setPickedSkills, k, on)} />
          ))}
        </div>
        {err("skills") && (
          <p role="alert" className="m-0 mt-2 text-sm text-danger">
            {err("skills")}
          </p>
        )}
        <div className="mt-3 max-w-sm">
          <TextField
            name="otherSkill"
            label={t("portfolio.otherSkill")}
            hint={t("portfolio.otherHint", { max: OTHER_MAX })}
            maxLength={OTHER_MAX}
            value={otherSkill}
            onChange={(e) => setOtherSkill(e.target.value)}
            error={err("otherSkill")}
          />
        </div>
        {extras && levelRows.length > 0 && (
          <div className="mt-4 space-y-2 rounded-2xl bg-frame p-3.5">
            <p className="m-0 text-sm text-muted">{t("portfolio.levelsHint")}</p>
            {levelRows.map((r) => (
              <label key={r.key} className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink">
                {r.label}
                <select name={`level_${r.key}`} value={levels[r.key] ?? ""} onChange={(e) => setLevels((x) => ({ ...x, [r.key]: e.target.value }))} aria-label={`${t("portfolio.level")}: ${r.label}`} className={SELECT}>
                  <option value="">{t("portfolio.levels.none")}</option>
                  {SKILL_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`portfolio.levels.${l}`)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-ink">{t("portfolio.toolsTitle")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOOLS.map((k) => (
            <Chip key={k} name="tools" value={k} label={t(`portfolio.tools.${k}`)} checked={pickedTools.has(k)} onChange={(on) => toggle(pickedTools, setPickedTools, k, on)} />
          ))}
        </div>
        <div className="mt-3 max-w-sm">
          <TextField
            name="otherTool"
            label={t("portfolio.otherTool")}
            hint={t("portfolio.otherHint", { max: OTHER_MAX })}
            maxLength={OTHER_MAX}
            value={otherTool}
            onChange={(e) => setOtherTool(e.target.value)}
            error={err("otherTool")}
          />
        </div>
        {extras && yearRows.length > 0 && (
          <div className="mt-4 space-y-2 rounded-2xl bg-frame p-3.5">
            <p className="m-0 text-sm text-muted">{t("portfolio.toolYearsHint")}</p>
            {yearRows.map((r) => (
              <label key={r.key} className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink">
                {r.label}
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    name={`years_${r.key}`}
                    inputMode="numeric"
                    min={0}
                    max={EXPERIENCE_MAX}
                    value={toolYears[r.key] ?? ""}
                    onChange={(e) => setToolYears((x) => ({ ...x, [r.key]: e.target.value }))}
                    aria-label={`${t("portfolio.toolYears")}: ${r.label}`}
                    className={cx(SELECT, "w-20")}
                  />
                  <span className="text-muted">{t("portfolio.toolYears")}</span>
                </span>
              </label>
            ))}
            {yearsError && <p className="m-0 text-sm text-danger">{yearsError}</p>}
          </div>
        )}
      </fieldset>

      {extras && (
        <fieldset>
          <legend className="text-sm font-medium text-ink">{t("portfolio.languagesTitle")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {LANGUAGES.map((k) => (
              <Chip key={k} name="languages" value={k} label={t(`portfolio.languages.${k}`)} checked={pickedLangs.has(k)} onChange={(on) => toggle(pickedLangs, setPickedLangs, k, on)} />
            ))}
          </div>
          <div className="mt-3 max-w-sm">
            <TextField
              name="otherLanguage"
              label={t("portfolio.otherLanguage")}
              hint={t("portfolio.otherHint", { max: OTHER_MAX })}
              maxLength={OTHER_MAX}
              value={otherLanguage}
              onChange={(e) => setOtherLanguage(e.target.value)}
              error={err("otherLanguage")}
            />
          </div>
        </fieldset>
      )}

      {state.status === "error" && !state.field && state.error && <p className="text-sm text-danger">{t(state.error.key, state.error.params)}</p>}
      <div className="flex justify-end">
        <SaveButton unsaved={unsaved} loading={pending}>
          {t("portfolio.save")}
        </SaveButton>
      </div>
    </form>
  );
}

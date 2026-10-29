"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { BUSINESS_TYPES, LIMITS, type BusinessType } from "@/lib/contests/brief";
import { useI18n } from "@/lib/i18n/client";
import { Agreement } from "./step-account";
import type { V2Actions } from "./wizard-v2";

/** The typed name, big, on a card: a first feel of "my logo" (spec §2 step 2). */
export function NamePreview({ name }: { name: string }) {
  const { t } = useI18n();
  const text = name.trim();
  return (
    <div className="flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-2xl bg-surface px-5 py-6 text-center shadow-card ring-1 ring-line" aria-live="polite">
      <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{t("wizardV2.basics.preview")}</span>
      <span className={text ? "break-words text-[clamp(28px,6vw,40px)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink" : "text-[22px] font-semibold text-line"}>
        {text || t("wizardV2.basics.previewEmpty")}
      </span>
    </div>
  );
}

/** Step 2: the logo name and the business type. Saving it makes the contest, with the brief filled in from the type. */
export function BasicsV2(props: {
  actions: V2Actions;
  contestId: string | null;
  businessTypes: string[];
  brandName: string;
  onBrandName: (v: string) => void;
  businessType: BusinessType | "";
  onBusinessType: (v: BusinessType | "") => void;
  businessTypeOther: string;
  onBusinessTypeOther: (v: string) => void;
  askAgreement: boolean;
  agreed: boolean;
  onAgreed: (on: boolean) => void;
  onError: (message: string | null) => void;
  onBack: () => void;
  onDone: (saved: { contestId: string; slug: string }) => void;
  /** The step's buttons: the team's help card keeps clear of them. */
  onBar: (el: HTMLDivElement | null) => void;
}) {
  const { t } = useI18n();
  const [busy, start] = useTransition();
  // Admin › Lists' order (hidden types left out); the chosen one stays even if it was hidden since.
  const listed = (props.businessTypes.length ? props.businessTypes : [...BUSINESS_TYPES]).filter((b): b is BusinessType => (BUSINESS_TYPES as readonly string[]).includes(b));
  const types = props.businessType && !listed.includes(props.businessType) ? [...listed, props.businessType] : listed;
  const name = props.brandName.trim();
  const nameOk = name.length >= LIMITS.brandName.min && name.length <= LIMITS.brandName.max;
  const ready = nameOk && props.businessType !== "" && (!props.askAgreement || props.agreed);

  const submit = () => {
    if (!ready) return;
    props.onError(null);
    start(async () => {
      const res = await props.actions.basics({ contestId: props.contestId, brandName: name, businessType: props.businessType, businessTypeOther: props.businessTypeOther, agreed: props.agreed });
      if (!res.ok) return props.onError(t(res.error.key, res.error.params));
      props.onDone({ contestId: res.contestId, slug: res.slug });
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-5">
        <TextField
          label={t("wizardV2.basics.logoName")}
          value={props.brandName}
          maxLength={LIMITS.brandName.max}
          onChange={(e) => props.onBrandName(e.target.value)}
          autoComplete="organization"
          autoFocus
        />
        <NamePreview name={props.brandName} />
        <SelectField
          label={t("wizardV2.basics.type")}
          placeholder={t("wizardV2.basics.typePick")}
          value={props.businessType}
          onChange={(e) => props.onBusinessType(e.target.value as BusinessType)}
          options={types.map((b) => ({ value: b, label: t(`wizard.businessTypes.${b}`) }))}
        />
        {props.businessType === "other" && (
          <TextField label={t("wizardV2.basics.other")} value={props.businessTypeOther} maxLength={LIMITS.businessTypeOther.max} onChange={(e) => props.onBusinessTypeOther(e.target.value)} />
        )}
        {props.askAgreement && <Agreement agreed={props.agreed} onAgreed={props.onAgreed} />}
      </div>
      <div ref={(el) => props.onBar(el)} className="mt-7 flex flex-col gap-2">
        <Button type="submit" size="lg" block loading={busy} disabled={!ready}>
          {t("wizardV2.next")}
        </Button>
        <Button type="button" variant="ghost" block onClick={props.onBack}>
          {t("wizardV2.back")}
        </Button>
      </div>
    </form>
  );
}

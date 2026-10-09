"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, PhoneField, TextAreaField, TextField } from "@/components/ui/field";
import { signAgreement, type AgreementState } from "@/lib/agreements/actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { ID_TYPES, signatureMatches, type IdType } from "@/lib/legal/agreement-rules";
import type { AgreementText } from "@/lib/legal/types";

const IDLE: AgreementState = { ok: false };

/** D-12 Originality agreement (UI-JOURNEY, owner 2026-10-09): details, declaration, typed signature. */
export function AgreementForm({ defaults, text, next }: { defaults: { fullName: string; mobile: string }; text: AgreementText; next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState(signAgreement, IDLE);
  const [fullName, setFullName] = useState(defaults.fullName);
  const [address, setAddress] = useState("");
  const [idType, setIdType] = useState<IdType>("nid");
  const [signature, setSignature] = useState("");
  // Every field is controlled, so nothing is lost when the server sends an error back.
  const [mobile, setMobile] = useState(defaults.mobile);
  const [idNumber, setIdNumber] = useState("");
  const [agreed, setAgreed] = useState(false);
  const matches = signatureMatches(fullName, signature);
  const err = (f: keyof NonNullable<AgreementState["errors"]>) => (state.errors?.[f] ? t(state.errors[f]) : undefined);

  useEffect(() => {
    if (state.ok && state.next) router.push(state.next);
  }, [state, router]);

  return (
    <form
      // onSubmit instead of action={…}: React resets a form after an action, which would untick "I agree" on an error.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-6"
    >
      <input type="hidden" name="next" value={next} />

      <section className="animate-rise space-y-4 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6" style={{ animationDelay: "80ms" }}>
        <h2 className="font-semibold text-ink">{t("agreement.details")}</h2>
        <TextField
          name="fullName"
          label={t("agreement.fullName")}
          hint={t("agreement.fullNameHint")}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={80}
          autoComplete="name"
          required
          error={err("fullName")}
        />
        <PhoneField name="mobile" label={t("agreement.mobile")} value={mobile} onChange={(e) => setMobile(e.target.value)} required error={err("mobile")} />
        <TextAreaField
          name="address"
          label={t("agreement.address")}
          hint={t("agreement.addressHint")}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={300}
          rows={3}
          required
          error={err("address")}
        />

        <fieldset>
          <legend className="text-sm font-medium text-ink">{t("agreement.idType")}</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ID_TYPES.map((type) => (
              <label
                key={type}
                className={cx(
                  "inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-[background-color,color,box-shadow] duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
                  idType === type ? "bg-primary text-white ring-primary" : "bg-surface text-ink ring-line hover:ring-primary",
                )}
              >
                <input type="radio" name="idType" value={type} checked={idType === type} onChange={() => (setIdType(type), setIdNumber(""))} className="sr-only" />
                {t(`agreement.idTypes.${type}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <TextField
          name="idNumber"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          label={t(`agreement.idNumber.${idType}`)}
          hint={t(`agreement.idHints.${idType}`)}
          inputMode={idType === "passport" ? "text" : "numeric"}
          autoComplete="off"
          maxLength={24}
          required
          error={err("idNumber")}
        />
        <p className="flex items-start gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs leading-relaxed text-muted">
          <svg viewBox="0 0 24 24" className="mt-px size-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <span>
            {t("agreement.idPrivate")}{" "}
            <Link href="/legal/privacy#id-numbers" target="_blank" className="font-semibold text-primary underline">
              {t("footer.privacy")}
            </Link>
          </span>
        </p>
      </section>

      <section className="animate-rise rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6" style={{ animationDelay: "160ms" }}>
        <h2 className="font-semibold text-ink">{text.title}</h2>
        <div className="mt-3 max-h-80 overflow-y-auto rounded-2xl bg-canvas p-4 text-sm leading-relaxed text-ink ring-1 ring-inset ring-line" tabIndex={0}>
          <p className="font-medium">{text.intro}</p>
          <ol className="mt-3 space-y-2.5">
            {text.clauses.map((c, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="w-5 shrink-0 font-semibold tabular-nums text-primary">{i + 1}.</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-muted">{text.closing}</p>
        </div>

        <div className="mt-5">
          <TextField
            name="signature"
            label={t("agreement.signLabel")}
            hint={matches ? t("agreement.signMatches") : t("agreement.signHint")}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            maxLength={80}
            autoComplete="off"
            required
            error={err("signature")}
            className="[&_input]:font-display [&_input]:text-xl [&_input]:italic"
          />
        </div>
        <Checkbox
          name="agreed"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-2"
          required
          label={
            <>
              {t("agreement.agree")}{" "}
              <Link href="/legal/designer-rules" target="_blank" className="font-semibold text-primary underline">
                {t("footer.designerRules")}
              </Link>
              {state.errors?.agreed && <span className="mt-1 block text-sm text-danger">{t(state.errors.agreed)}</span>}
            </>
          }
        />
      </section>

      {state.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {t(state.error)}
        </p>
      )}
      <Button type="submit" size="lg" block loading={pending || state.ok} disabled={!matches}>
        {t("agreement.submit")}
      </Button>
    </form>
  );
}

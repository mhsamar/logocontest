"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, PhoneField, TextField } from "@/components/ui/field";
import { ImageDrop } from "@/components/ui/image-drop";
import { DEFAULT_COUNTRY } from "@/lib/countries";
import { signAgreement, type AgreementState } from "@/lib/agreements/actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { ID_TYPES, needsBackPhoto, signatureMatches, type IdType } from "@/lib/legal/agreement-rules";
import type { AgreementText } from "@/lib/legal/types";

const IDLE: AgreementState = { ok: false };

/** D-12 Originality agreement (UI-JOURNEY, owner 2026-10-09): details, declaration, typed signature. */
/** `countries` comes from the server, so the names are the same on the server and in the browser. */
export function AgreementForm({ defaults, text, next, countries }: { defaults: { fullName: string; mobile: string }; text: AgreementText; next: string; countries: { code: string; name: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState(signAgreement, IDLE);
  const [fullName, setFullName] = useState(defaults.fullName);
  // The address in parts (owner, 2026-10-10).
  const [addr, setAddr] = useState({ house: "", road: "", area: "", postCode: "", country: DEFAULT_COUNTRY });
  const [front, setFront] = useState<File[]>([]);
  const [back, setBack] = useState<File[]>([]);
  const [idType, setIdType] = useState<IdType>("nid");
  const [signature, setSignature] = useState("");
  // Every field is controlled, so nothing is lost when the server sends an error back.
  const [mobile, setMobile] = useState(defaults.mobile);
  const [idNumber, setIdNumber] = useState("");
  const [agreed, setAgreed] = useState(false);
  const matches = signatureMatches(fullName, signature);
  const err = (f: keyof NonNullable<AgreementState["errors"]>) => (state.errors?.[f] ? t(state.errors[f]!) : undefined);
  const setPart = (k: keyof typeof addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  useEffect(() => {
    if (state.ok && state.next) router.push(state.next);
  }, [state, router]);

  return (
    <form
      // onSubmit instead of action={…}: React resets a form after an action, which would untick "I agree" on an error.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        if (front[0]) data.set("idFront", front[0]);
        if (back[0] && needsBackPhoto(idType)) data.set("idBack", back[0]);
        startTransition(() => action(data));
      }}
      className="space-y-6"
    >
      <input type="hidden" name="next" value={next} />

      <section className="space-y-4 lc-card p-5 sm:p-7">
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
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink">{t("agreement.address")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField name="house" label={t("agreement.addr.house")} value={addr.house} onChange={setPart("house")} maxLength={80} autoComplete="address-line1" required error={err("house")} />
            <TextField name="road" label={t("agreement.addr.road")} value={addr.road} onChange={setPart("road")} maxLength={80} autoComplete="address-line2" error={err("address")} />
            <TextField name="area" label={t("agreement.addr.area")} hint={t("agreement.addr.areaHint")} value={addr.area} onChange={setPart("area")} maxLength={80} autoComplete="address-level2" required error={err("area")} />
            <TextField name="postCode" label={t("agreement.addr.postCode")} value={addr.postCode} onChange={setPart("postCode")} maxLength={12} inputMode="numeric" autoComplete="postal-code" />
          </div>
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("agreement.addr.country")}</span>
            <select
              name="country"
              value={addr.country}
              onChange={setPart("country")}
              autoComplete="country"
              className="mt-1.5 block min-h-12 w-full rounded-[14px] bg-surface px-3.5 text-[15px] text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            {err("country") && <span className="mt-1 block text-sm text-danger">{err("country")}</span>}
          </label>
        </fieldset>

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
        {/* A photo of the ID (owner, 2026-10-10): drag in, choose, or take one with the phone camera. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageDrop label={t(`agreement.photo.front.${idType}`)} hint={t("agreement.photo.hint")} files={front} onChange={setFront} error={err("idFront")} />
          {needsBackPhoto(idType) && <ImageDrop label={t("agreement.photo.back")} files={back} onChange={setBack} error={err("idBack")} />}
        </div>
        <p className="flex items-start gap-2 rounded-[14px] bg-chip px-3 py-2.5 text-xs leading-relaxed text-muted">
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

      <section className="lc-card p-5 sm:p-7">
        <h2 className="font-semibold text-ink">{text.title}</h2>
        <div className="mt-3 max-h-80 overflow-y-auto rounded-2xl bg-chip p-4 text-sm leading-relaxed text-ink ring-1 ring-inset ring-line" tabIndex={0}>
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
        <p role="alert" className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">
          {t(state.error)}
        </p>
      )}
      <Button type="submit" size="lg" block loading={pending || state.ok} disabled={!matches}>
        {t("agreement.submit")}
      </Button>
    </form>
  );
}

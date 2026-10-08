"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/toast";
import {
  checkAccountDetails,
  createAccountAndDraft,
  prepareBriefUpload,
  recordBriefUpload,
  removeBriefFile,
  saveDraft,
  startCheckout,
  type WizardResult,
} from "@/lib/contests/actions";
import { CONTACT_CHECKED_FIELDS, LIMITS, validateBriefStep, type Brief, type ContactCheckedField, type Order } from "@/lib/contests/brief";
import { calculatePrice, defaultOrder, validateOrder, type PricingConfig } from "@/lib/contests/pricing";
import { normalizeEmail } from "@/lib/auth/identity";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { normalizeBdMobile } from "@/lib/phone";
import { formatTaka } from "@/lib/money";
import { subscribeToPush } from "@/lib/push/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { deleteFile, getFile } from "./file-store";
import { PriceBar, PriceSidebar } from "./price-summary";
import { initialState, loadState, saveState, type ServerFile, type WizardState } from "./state";
import { AccountStep, PasswordStep } from "./steps-account";
import { BrandStep, BusinessStep, ColorsStep, RequirementsStep, StylesStep, WebsiteStep, type BriefStepProps } from "./steps-brief";
import { FilesStep, PackageStep } from "./steps-order";
import { ReviewStep, type UploadState } from "./step-review";

export type WizardProps = {
  user: { name: string; mobile: string } | null;
  pricing: PricingConfig;
  fileLimits: { maxFiles: number; maxMb: number };
  passwordMin: number;
  previous: { id: string; brandName: string; brief: Brief }[];
  resume: { contestId: string; brief: Brief; order: Order; files: ServerFile[] } | null;
  initialStep: number | null;
  prefillName: string;
};

const HEADINGS = ["c01", "c02", "c03", "c04", "c05", "c06", "c07", "c08", "c09", "c10", "c11"] as const;
const BUCKET = "contest-files";

export function Wizard(props: WizardProps) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const steps = useMemo(() => (props.user ? [1, 2, 3, 4, 5, 6, 7, 8, 11] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), [props.user]);

  const [state, setState] = useState<WizardState | null>(null);
  const [step, setStep] = useState(1);
  const [serverFiles, setServerFiles] = useState<ServerFile[]>(props.resume?.files ?? []);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [accountError, setAccountError] = useState<{ field: "mobile" | "email"; message: string; taken: boolean } | null>(null);
  const [touchedAccount, setTouchedAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [name, setName] = useState(props.user?.name ?? "");
  const [method, setMethod] = useState<"bkash" | "card" | null>(null);
  const [terms, setTerms] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fromReview, setFromReview] = useState(false);
  // A brief error only the server can find (the no-contact filter). Shown on its field until that text changes.
  const [serverError, setServerError] = useState<{ field: ContactCheckedField; key: MessageKey; value: string } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  // ---- load + autosave ------------------------------------------------------
  useEffect(() => {
    const saved = loadState();
    let next: WizardState;
    if (props.resume) {
      next = { ...initialState(props.resume.order), brief: props.resume.brief, contestId: props.resume.contestId };
    } else {
      next = saved ?? initialState(defaultOrder(props.pricing));
    }
    // A name typed on the home page always wins, so the client never types it twice.
    const heroName = props.prefillName.trim().slice(0, LIMITS.brandName.max);
    const fromHero = !props.resume && heroName.length >= LIMITS.brandName.min;
    if (fromHero) next = { ...next, brief: { ...next.brief, brandName: heroName } };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
    setState(next);
    // Coming from the home page with a name: C-01 is already answered, start at C-02.
    const wanted = props.initialStep ?? (fromHero ? 2 : 1);
    const first = firstReachable(wanted, next, steps, props.pricing);
    setStep(first);
    // Drop ?name= so a reload doesn't overwrite later edits, and give Back a history entry.
    window.history.replaceState({ step: first }, "", `?step=${first}`);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const go = useCallback(
    (to: number, push = true) => {
      setStep(to);
      setError(null);
      if (push) window.history.pushState({ step: to }, "", `?step=${to}`);
      top.current?.scrollIntoView({ block: "start" });
    },
    [],
  );

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { step?: number } | null)?.step;
      if (s && steps.includes(s)) setStep(s);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [steps]);

  const updateBrief = useCallback((patch: Partial<Brief>) => setState((s) => (s ? { ...s, brief: { ...s.brief, ...patch } } : s)), []);
  const updateOrder = useCallback((patch: Partial<Order>) => setState((s) => (s ? { ...s, order: { ...s.order, ...patch } } : s)), []);
  const touch = useCallback((f: string) => setTouched((t) => (t.has(f) ? t : new Set(t).add(f))), []);

  /** Shows a server error on its brief field and goes to that step. False when it belongs in the general alert. */
  const showFieldError = useCallback(
    (e: { key: MessageKey; field?: ContactCheckedField }, s: WizardState) => {
      const field = inlineField(e);
      if (!field) return false;
      setServerError({ field, key: e.key, value: s.brief[field] });
      touch(field);
      // Signed in: the rest is already saved, so Next can return straight to the review.
      if (props.user) setFromReview(true);
      go(CONTACT_CHECKED_FIELDS[field]);
      return true;
    },
    [props.user, go, touch],
  );

  const price = useMemo(() => {
    if (!state || validateOrder(state.order, props.pricing)) return null;
    return calculatePrice(state.order, props.pricing);
  }, [state, props.pricing]);

  // ---- server draft + uploads ----------------------------------------------
  const persistDraft = useCallback(
    async (s: WizardState): Promise<WizardResult<{ contestId: string }>> => {
      let result = await saveDraft({ brief: s.brief, order: s.order, contestId: s.contestId });
      if (!result.ok && s.contestId && !result.error.field) {
        // The stored draft may belong to another account on this device: start a new one.
        result = await saveDraft({ brief: s.brief, order: s.order, contestId: null });
      }
      if (!result.ok) {
        if (!showFieldError(result.error, s)) setError(t(result.error.key, result.error.params));
        return result;
      }
      const { contestId } = result;
      setState((cur) => (cur ? { ...cur, contestId } : cur));
      return result;
    },
    [t, showFieldError],
  );

  const uploadPending = useCallback(
    async (contestId: string, s: WizardState) => {
      if (s.localFiles.length === 0) return;
      setUploads(s.localFiles.map((f) => ({ name: f.name, status: "waiting" })));
      const supabase = createBrowserSupabase();
      const remaining = [...s.localFiles];
      for (let i = 0; i < s.localFiles.length; i++) {
        const f = s.localFiles[i];
        setUploads((u) => u.map((x, j) => (j === i ? { ...x, status: "uploading" } : x)));
        const ok = await (async () => {
          const blob = await getFile(f.id);
          if (!blob) return false;
          const prepared = await prepareBriefUpload({ contestId, name: f.name, type: f.type, size: f.size });
          if (!prepared.ok) return false;
          const up = await supabase.storage.from(BUCKET).uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: f.type });
          if (up.error) return false;
          const rec = await recordBriefUpload({ contestId, path: prepared.path, name: f.name, type: f.type, size: f.size, isCurrentLogo: f.isCurrentLogo });
          if (!rec.ok) return false;
          setServerFiles((sf) => [...sf, { id: rec.id, name: f.name, type: f.type, isCurrentLogo: f.isCurrentLogo }]);
          await deleteFile(f.id);
          remaining.splice(remaining.indexOf(f), 1);
          return true;
        })().catch(() => false);
        setUploads((u) => u.map((x, j) => (j === i ? { ...x, status: ok ? "done" : "error" } : x)));
      }
      setState((cur) => (cur ? { ...cur, localFiles: remaining } : cur));
    },
    [],
  );

  // Entering C-11: make sure the server draft is current, then upload any files.
  const enteredReview = useRef(false);
  useEffect(() => {
    if (step !== 11 || !state || enteredReview.current) return;
    enteredReview.current = true;
    startBusy(async () => {
      const saved = await persistDraft(state);
      if (saved.ok) await uploadPending(saved.contestId, state);
    });
  }, [step, state, persistDraft, uploadPending]);
  useEffect(() => {
    if (step !== 11) enteredReview.current = false;
  }, [step]);

  if (!state) {
    return <div className="mx-auto h-96 w-full max-w-xl animate-pulse px-4 py-10" aria-busy />;
  }

  // ---- validity per step -----------------------------------------------------
  const stepErrors = step <= 6 ? validateBriefStep(step, state.brief) : {};
  const serverErrorShown =
    serverError && CONTACT_CHECKED_FIELDS[serverError.field] === step && state.brief[serverError.field] === serverError.value;
  const briefErrors = serverErrorShown ? { [serverError.field]: serverError.key, ...stepErrors } : stepErrors;
  const nameValid = name.trim().length >= 2;
  const uploading = uploads.some((u) => u.status === "uploading" || u.status === "waiting");
  const valid =
    step <= 6
      ? Object.keys(briefErrors).length === 0
      : step === 7
        ? true
        : step === 8
          ? price !== null
          : step === 9
            ? normalizeBdMobile(state.mobile) !== null && normalizeEmail(state.email) !== null
            : step === 10
              ? password.length >= props.passwordMin
              : nameValid && method !== null && terms && !uploading && !busy && price !== null && Boolean(state.contestId);

  const index = steps.indexOf(step);
  const nextStep = fromReview && step < 11 ? 11 : steps[index + 1];

  const onNext = () => {
    if (!valid) return;
    if (step === 8 && props.user) {
      startBusy(async () => {
        const saved = await persistDraft(state);
        if (saved.ok) go(11);
      });
      return;
    }
    if (step === 9) {
      startBusy(async () => {
        const res = await checkAccountDetails({ mobile: state.mobile, email: state.email });
        if (!res.ok) {
          const key = res.error.key;
          const fieldError = ["auth.errors.phoneTaken", "auth.errors.invalidPhone", "wizard.errors.emailTaken", "wizard.errors.email"].includes(key);
          if (!fieldError) {
            // Not about either field (e.g. the database is down): show it in the general alert.
            setError(t(key, res.error.params));
            return;
          }
          setAccountError({
            field: key === "auth.errors.phoneTaken" || key === "auth.errors.invalidPhone" ? "mobile" : "email",
            message: t(key, res.error.params),
            taken: key === "auth.errors.phoneTaken" || key === "wizard.errors.emailTaken",
          });
          return;
        }
        go(10);
      });
      return;
    }
    if (step === 10) {
      startBusy(async () => {
        // Asks for notification permission while we still have the click (BLUEPRINT §12: welcome push).
        const push = await subscribeToPush();
        const res: WizardResult<{ contestId: string }> = await createAccountAndDraft({
          push,
          mobile: state.mobile,
          password,
          email: state.email,
          brief: state.brief,
          order: state.order,
        });
        if (!res.ok) {
          if (!showFieldError(res.error, state)) setError(t(res.error.key, res.error.params));
          return;
        }
        setState((cur) => (cur ? { ...cur, contestId: res.contestId } : cur));
        setPassword("");
        router.refresh(); // header and server props now see the signed-in client
        go(11);
      });
      return;
    }
    if (step === 11) {
      startBusy(async () => {
        const res = await startCheckout({ contestId: state.contestId!, method: method!, name, acceptedTerms: terms });
        // On success the action redirects to the gateway, so we only get here on failure.
        if (res && !res.ok && !showFieldError(res.error, state)) setError(t(res.error.key, res.error.params));
      });
      return;
    }
    if (nextStep === 11) setFromReview(false);
    go(nextStep);
  };

  const onBack = () => {
    if (index <= 0) {
      router.push("/");
      return;
    }
    go(steps[index - 1]);
  };

  const onSaveExit = () => {
    startBusy(async () => {
      if (props.user && Object.keys(validateBriefStep(1, state.brief)).length === 0) {
        const saved = await persistDraft(state).catch(() => null);
        // Stay so the client can fix the field the wizard just jumped to.
        if (saved && !saved.ok && inlineField(saved.error)) return;
      }
      toast(t("wizard.frame.savedOnDevice"), "info");
      router.push("/");
    });
  };

  const goToFromReview = (s: number) => {
    setFromReview(true);
    go(s);
  };

  const briefProps: BriefStepProps = { brief: state.brief, update: updateBrief, errors: briefErrors, touched, touch };
  const key = HEADINGS[step - 1];
  const showPrice = step >= 8 && price !== null;
  const nextLabel =
    step === 11 && price ? t("wizard.c11.pay", { total: formatTaka(price.total, locale) }) : fromReview && step < 11 ? t("wizard.frame.backToReview") : t("wizard.frame.next");

  return (
    <div ref={top} className="mx-auto w-full max-w-page scroll-mt-16 px-4 pb-8 pt-4 sm:pt-6">
      <div className={showPrice ? "lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10" : ""}>
        <div className="mx-auto w-full max-w-xl">
          {/* Wizard frame: back arrow, stepper, Save & exit */}
          <div className="mb-6 flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label={t("wizard.frame.back")}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-canvas"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex-1">
              <Stepper current={index + 1} total={steps.length} label={t("common.stepOf", { current: index + 1, total: steps.length })} />
            </div>
            <button type="button" onClick={onSaveExit} className="ml-2 min-h-11 shrink-0 px-1 text-sm font-semibold text-primary hover:underline">
              {t("wizard.frame.saveExit")}
            </button>
          </div>

          {/* Each step slides in when it changes (UI-JOURNEY §1.5) */}
          <div key={step} className="animate-step-in">
            <h1 className="text-h2 font-bold leading-tight tracking-tight text-ink lg:text-h2-lg">{t(`wizard.${key}.heading`)}</h1>
            <p className="mb-6 mt-2 text-muted">{t(`wizard.${key}.helper`, { max: props.fileLimits.maxFiles, mb: props.fileLimits.maxMb })}</p>

            {step === 1 && props.user && props.previous.length > 0 && !state.brief.businessDescription && (
              <PreviousBriefs previous={props.previous} onUse={(b) => updateBrief({ ...b })} />
            )}

            {step === 1 && <BrandStep {...briefProps} />}
            {step === 2 && <BusinessStep {...briefProps} />}
            {step === 3 && <WebsiteStep {...briefProps} />}
            {step === 4 && <StylesStep {...briefProps} />}
            {step === 5 && <ColorsStep {...briefProps} />}
            {step === 6 && <RequirementsStep {...briefProps} />}
            {step === 7 && (
              <FilesStep
                localFiles={state.localFiles}
                serverFiles={serverFiles}
                limits={props.fileLimits}
                onChange={(localFiles) => setState({ ...state, localFiles })}
                onRemoveServerFile={(id) =>
                  startBusy(async () => {
                    if (state.contestId) await removeBriefFile({ contestId: state.contestId, fileId: id });
                    setServerFiles((f) => f.filter((x) => x.id !== id));
                  })
                }
              />
            )}
            {step === 8 && <PackageStep order={state.order} update={updateOrder} config={props.pricing} />}
            {step === 9 && (
              <AccountStep
                mobile={state.mobile}
                email={state.email}
                onMobile={(mobile) => {
                  setState({ ...state, mobile });
                  setAccountError(null);
                }}
                onEmail={(email) => {
                  setState({ ...state, email });
                  setAccountError(null);
                  setTouchedAccount(true);
                }}
                mobileError={
                  accountError?.field === "mobile" && !accountError.taken
                    ? accountError.message
                    : state.mobile.trim().length >= 11 && !normalizeBdMobile(state.mobile)
                      ? t("auth.errors.invalidPhone")
                      : undefined
                }
                emailError={
                  accountError?.field === "email" && !accountError.taken
                    ? accountError.message
                    : touchedAccount && state.email.includes("@") && state.email.length > 5 && !normalizeEmail(state.email)
                      ? t("wizard.errors.email")
                      : undefined
                }
                taken={Boolean(accountError?.taken)}
              />
            )}
            {step === 10 && <PasswordStep password={password} onPassword={setPassword} min={props.passwordMin} />}
            {step === 11 && price && (
              <ReviewStep
                brief={state.brief}
                order={state.order}
                price={price}
                feePercent={props.pricing.serviceFeePercent}
                name={name}
                onName={setName}
                method={method}
                onMethod={setMethod}
                terms={terms}
                onTerms={setTerms}
                uploads={uploads}
                onRetryUploads={() => state.contestId && startBusy(() => uploadPending(state.contestId!, state))}
                goTo={goToFromReview}
              />
            )}
          </div>

          {error && (
            <div className="mt-6">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}

          {/* Bottom bar: sticky on phones, inline on larger screens */}
          <div className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0">
            {showPrice && <PriceBar key={step} price={price} feePercent={props.pricing.serviceFeePercent} />}
            <Button size="lg" block onClick={onNext} disabled={!valid} loading={busy && step !== 9}>
              {nextLabel}
            </Button>
            {step === 11 && <p className="mt-2 text-center text-xs text-muted">{t("wizard.c11.secureNote")}</p>}
            <p className="mt-2 text-center text-xs text-muted">{t("wizard.frame.savedOnDevice")}</p>
          </div>
        </div>

        {showPrice && <PriceSidebar price={price} feePercent={props.pricing.serviceFeePercent} />}
      </div>
    </div>
  );
}

/** The brief field a server error should show on. Likes/dislikes have no input any more, so theirs go in the alert. */
function inlineField(e: { field?: ContactCheckedField }): ContactCheckedField | null {
  return e.field && e.field !== "likes" && e.field !== "dislikes" ? e.field : null;
}

/** Never land past the first unfinished step (e.g. a stale ?step=11 link). */
function firstReachable(wanted: number, s: WizardState, steps: number[], cfg: PricingConfig): number {
  for (const st of steps) {
    if (st >= wanted) return steps.includes(wanted) ? wanted : st;
    const incomplete = st <= 6 ? Object.keys(validateBriefStep(st, s.brief)).length > 0 : st === 8 ? validateOrder(s.order, cfg) !== null : st === 9 || st === 10;
    if (incomplete) return st;
  }
  return steps[steps.length - 1];
}

function PreviousBriefs({ previous, onUse }: { previous: WizardProps["previous"]; onUse: (b: Brief) => void }) {
  const { t } = useI18n();
  return (
    <div className="mb-6 rounded-lg bg-surface p-4 ring-1 ring-line">
      <p className="text-sm font-semibold text-ink">{t("wizard.previous.title")}</p>
      <ul className="mt-2 divide-y divide-line">
        {previous.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-1">
            <span className="truncate text-sm text-ink">{p.brandName}</span>
            <Button variant="ghost" onClick={() => onUse(p.brief)} className="shrink-0">
              {t("wizard.previous.use")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

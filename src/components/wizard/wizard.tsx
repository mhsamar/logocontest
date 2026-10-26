"use client";

import { recordWizardStep, saveWizardLead } from "@/lib/wizard-tracking";
import { ShareOnFacebook } from "@/components/wizard/share-facebook";
import { setContestShare } from "@/lib/cards/actions";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/toast";
import {
  checkAccountDetails,
  createAccountAndDraft,
  prepareBriefUpload,
  recordBriefUpload,
  removeBriefFile,
  saveDraft,
  previewPromo,
  startCheckout,
  type WizardResult,
} from "@/lib/contests/actions";
import { BRIEF_STEPS, LIMITS, validateBriefStep, WIZARD_STEPS, type Brief, type Order } from "@/lib/contests/brief";
import { isPersonName } from "@/lib/profile/name-rules";
import { calculatePrice, defaultOrder, validateOrder, type PricingConfig } from "@/lib/contests/pricing";
import { normalizeEmail } from "@/lib/auth/identity";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { toE164 } from "@/lib/phone";
import type { PublicMethod } from "@/lib/payments/manual-rules";
import { subscribeToPush } from "@/lib/push/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { deleteFile, getFile } from "./file-store";
import { PriceBar, PriceSidebar } from "./price-summary";
import { initialState, loadPending, loadState, savePending, saveState, type ServerFile, type WizardState } from "./state";
import { wizardVisitId } from "./visit-id";
import { HelpCard } from "./help-card";
import { StartVideoCorner } from "./start-video";
import type { StartVideo } from "@/lib/home/how-video";
import { useWizardLive } from "./use-wizard-live";
import { logoLiveAnswers } from "@/lib/wizard-live-rules";
import { pixelStartId, trackPixel } from "@/lib/analytics/meta-pixel";
import { AccountStep, PasswordStep } from "./steps-account";
import { BrandStep, BusinessStep, LinksStep, LookStep, NeedsStep, Part, type BriefChoices, type BriefStepProps } from "./steps-brief";
import { FilesStep, PackageStep } from "./steps-order";
import { ReviewStep, type PromoPreview, type UploadState } from "./step-review";
import { FieldInput } from "@/components/services/field-input";
import { checkExtraAnswers, clientStepShown, EMPTY_ONBOARDING, extraOn, type OnboardingConfig } from "@/lib/onboarding/config";
import type { Lang } from "@/lib/services/types";

export type WizardProps = {
  user: { name: string; mobile: string } | null;
  pricing: PricingConfig;
  fileLimits: { maxFiles: number; maxMb: number };
  passwordMin: number;
  previous: { id: string; brandName: string; brief: Brief }[];
  /** A saved draft reopened; `contentOk`: the content rules were already agreed for it (owner, 2026-10-26). */
  resume: { contestId: string; brief: Brief; order: Order; files: ServerFile[]; contentOk?: boolean } | null;
  initialStep: number | null;
  prefillName: string;
  /** Admin lists (A-15): business types in order (hidden ones left out) and suggested colours. */
  choices: BriefChoices;
  /** Designer Pro plan (owner, 2026-10-13): after saving, the optional "Invite Pro designers" step comes before paying. */
  inviteFirst?: boolean;
  /** Payment methods switched on in Admin › Payments › Methods (owner, 2026-10-14). */
  methods: PublicMethod[];
  /** Questions the owner hid or added (Admin › Onboarding, owner 2026-10-14). */
  onboarding?: OnboardingConfig;
  /** The money-back guarantee's number of designers while it is offered (owner, 2026-10-21), else null. */
  guarantee?: number | null;
  /** "Share my contest on Facebook" (owner, 2026-10-19), once migration 0067 has run; the resumed draft's choice. */
  shareSwitch?: boolean;
  resumeShare?: boolean;
  /** The tutorial video in the corner (owner, 2026-10-26), or null when it is off. */
  video?: StartVideo | null;
};


/** The texts (heading and helper) of each of the 8 steps (owner, 2026-10-15). */
const HEADINGS: Record<number, string> = { 1: "you", 2: "c01", 3: "c02", 4: "links", 5: "look", 6: "needs", 7: "c08", 8: "c11" };
const S = WIZARD_STEPS;
const NAME_MAX = 60;
const BUCKET = "contest-files";

export function Wizard(props: WizardProps) {
  const { t, locale, price: money } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const onboarding = props.onboarding ?? EMPTY_ONBOARDING;
  const hidden = useMemo(() => new Set(onboarding.hidden), [onboarding]);
  // A brief step whose every question the owner hid is skipped (Admin › Onboarding, owner 2026-10-14).
  // Owner, 2026-10-15: 8 steps. A signed-in client skips "About you" (and the password on the prize step).
  const steps = useMemo(
    () => (props.user ? [2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8]).filter((s) => !(BRIEF_STEPS as readonly number[]).includes(s) || clientStepShown(onboarding, s)),
    [props.user, onboarding],
  );

  const [state, setState] = useState<WizardState | null>(null);
  const [step, setStep] = useState(1);
  const [serverFiles, setServerFiles] = useState<ServerFile[]>(props.resume?.files ?? []);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [accountError, setAccountError] = useState<{ field: "mobile" | "email"; message: string; taken: boolean } | null>(null);
  const [touchedAccount, setTouchedAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<string | null>(props.methods.length === 1 ? props.methods[0].key : null);
  const [promo, setPromo] = useState<PromoPreview | null>(null);
  const [terms, setTerms] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [busy, startBusy] = useTransition();
  const [paying, setPaying] = useState(false);
  // Room kept under the last fields for the help card, so it never sits over them (owner, 2026-10-25).
  const [helpSpace, setHelpSpace] = useState(0);
  // And for the tutorial video in the corner (owner, 2026-10-26).
  const [videoSpace, setVideoSpace] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fromReview, setFromReview] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  // Once the contest is saved, the address keeps it (owner, 2026-10-26): a reload or Back reopens that contest (with
  // its answers and agreement), never a new blank one.
  const draftRef = useRef<string | null>(null);
  const stepUrl = useCallback((to: number) => `?${new URLSearchParams({ ...(draftRef.current ? { draft: draftRef.current } : {}), step: String(to) })}`, []);

  // ---- load + autosave ------------------------------------------------------
  useEffect(() => {
    const saved = loadState();
    let next: WizardState;
    if (props.resume) {
      // Reference photos this device still holds for this draft are kept, so the review uploads them (owner,
      // 2026-10-22: they were dropped when the client came back from inviting Pro designers).
      const pending = loadPending(props.resume.contestId);
      const keep = pending.length ? pending : saved?.contestId === props.resume.contestId ? saved.localFiles : [];
      // Agreed to the content rules already (on the server, or on this device for this contest): never asked twice.
      const agreed = props.resume.contentOk === true || (saved?.contestId === props.resume.contestId && saved.contentOk === true);
      next = { ...initialState(props.resume.order), brief: props.resume.brief, contestId: props.resume.contestId, shareFb: props.resumeShare ?? true, localFiles: keep, ...(agreed ? { contentOk: true } : {}) };
    } else {
      // A new contest starts blank (owner, 2026-10-14). What this device kept is only reused while that contest isn't
      // saved yet; a saved one is a draft on the server, opened from the dashboard instead.
      next = saved && !saved.contestId ? saved : initialState(defaultOrder(props.pricing));
    }
    // A name typed on the home page always wins, so the client never types it twice.
    const heroName = props.prefillName.trim().slice(0, LIMITS.brandName.max);
    const fromHero = !props.resume && heroName.length >= LIMITS.brandName.min;
    if (fromHero) next = { ...next, brief: { ...next.brief, brandName: heroName } };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
    setState(next);
    // Coming from the home page with a brand name: a signed-in client starts at the business step.
    const wanted = props.initialStep ?? (fromHero && props.user ? S.business : 1);
    const first = firstReachable(wanted, next, steps, props.pricing, onboarding);
    setStep(first);
    // Drop ?name= so a reload doesn't overwrite later edits, and give Back a history entry. On the next tick: on a fresh
    // page Next's router only starts listening to the address after this, and would put its old one back.
    draftRef.current = next.contestId;
    window.setTimeout(() => window.history.replaceState({ step: first }, "", stepUrl(first)), 0);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Meta Pixel (owner, 2026-10-24): a new contest started in this tab, once. Coming back to a saved draft sends nothing.
  useEffect(() => {
    if (!props.resume) trackPixel(`initiate:${pixelStartId()}`, "InitiateCheckout");
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  // Drop-off tracking for the admin dashboard: the furthest step this visit reached (no personal data).
  const contestId = state?.contestId ?? null;
  useEffect(() => {
    if (!state) return;
    void recordWizardStep(wizardVisitId(), step, contestId);
  }, [step, contestId, state === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Creating a contest right now" (owner, 2026-10-25): the step and the form's answers for the team (never the
  // contact details, password or payment choices), and the one help message they may send.
  const liveAnswers = useMemo(() => (state ? logoLiveAnswers(state.brief, state.order, state.localFiles.length + serverFiles.length) : {}), [state, serverFiles.length]);
  // Pay pressed: "went to payment" (9) at once, so no help message is sent while checkout starts.
  const live = useWizardLive({ on: state !== null, service: "logo", stage: paying ? S.review + 1 : step, pos: steps.indexOf(step) + 1, of: steps.length, contestId, answers: liveAnswers });

  // The contest is saved: its address carries it on every step (also one reached with Back from before the save). A
  // fresh history state, so Next's router learns the address too and doesn't put the old one back.
  useEffect(() => {
    if (!contestId) return;
    draftRef.current = contestId;
    if (new URLSearchParams(window.location.search).get("draft") === contestId) return;
    window.history.replaceState({ step }, "", stepUrl(step));
  }, [contestId, step, stepUrl]);

  const go = useCallback(
    (to: number, push = true) => {
      setStep(to);
      setError(null);
      if (push) window.history.pushState({ step: to }, "", stepUrl(to));
      top.current?.scrollIntoView({ block: "start" });
    },
    [stepUrl],
  );

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      // Next's router may rewrite an entry's state without our step: the address has it too.
      const s = (e.state as { step?: number } | null)?.step ?? Number(new URLSearchParams(window.location.search).get("step"));
      if (s && steps.includes(s)) setStep(s);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [steps]);

  const updateBrief = useCallback((patch: Partial<Brief>) => setState((s) => (s ? { ...s, brief: { ...s.brief, ...patch } } : s)), []);
  const updateOrder = useCallback((patch: Partial<Order>) => setState((s) => (s ? { ...s, order: { ...s.order, ...patch } } : s)), []);
  const touch = useCallback((f: string) => setTouched((t) => (t.has(f) ? t : new Set(t).add(f))), []);

  const price = useMemo(() => {
    if (!state || validateOrder(state.order, props.pricing)) return null;
    return calculatePrice(state.order, props.pricing);
  }, [state, props.pricing]);

  // ---- server draft + uploads ----------------------------------------------
  const persistDraft = useCallback(
    async (s: WizardState): Promise<WizardResult<{ contestId: string }>> => {
      // The content rules agreed in this wizard go with the draft, so reopening it never asks again (owner, 2026-10-26).
      let result = await saveDraft({ brief: s.brief, order: s.order, contestId: s.contestId, acceptedContentRules: s.contentOk === true });
      if (!result.ok && s.contestId && !result.error.field) {
        // The stored draft may belong to another account on this device: start a new one.
        result = await saveDraft({ brief: s.brief, order: s.order, contestId: null, acceptedContentRules: s.contentOk === true });
      }
      if (!result.ok) {
        setError(t(result.error.key, result.error.params));
        return result;
      }
      const { contestId } = result;
      // In the address from the very next step (Next's router keeps it).
      draftRef.current = contestId;
      setState((cur) => (cur ? { ...cur, contestId } : cur));
      // The Facebook switch is saved on its own (owner, 2026-10-19), so the draft itself stays as it was.
      if (props.shareSwitch) void setContestShare({ contestId, on: s.shareFb !== false });
      return result;
    },
    [t, props.shareSwitch],
  );

  // One upload run at a time: Retry, or coming back to the review, never sends the same photo twice.
  const uploadRun = useRef(false);
  const uploadPending = useCallback(
    async (contestId: string, s: WizardState) => {
      if (s.localFiles.length === 0 || uploadRun.current) return;
      uploadRun.current = true;
      // A photo leaves the list (by id, so one added meanwhile stays) and the draft's saved list at once, so a reload
      // never sends it twice (owner, 2026-10-22).
      const drop = (id: string) =>
        setState((cur) => {
          if (!cur) return cur;
          const localFiles = cur.localFiles.filter((x) => x.id !== id);
          savePending(contestId, localFiles);
          return { ...cur, localFiles };
        });
      try {
        setUploads(s.localFiles.map((f) => ({ name: f.name, status: "waiting" })));
        const supabase = createBrowserSupabase();
        for (let i = 0; i < s.localFiles.length; i++) {
          const f = s.localFiles[i];
          setUploads((u) => u.map((x, j) => (j === i ? { ...x, status: "uploading" } : x)));
          const ok = await (async () => {
            const blob = await getFile(f.id);
            // Gone from this device: it can't be sent any more, so it shows as failed and the client adds it again.
            if (!blob) {
              drop(f.id);
              return false;
            }
            const prepared = await prepareBriefUpload({ contestId, name: f.name, type: f.type, size: f.size });
            if (!prepared.ok) return false;
            const up = await supabase.storage.from(BUCKET).uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: f.type });
            if (up.error) return false;
            const rec = await recordBriefUpload({ contestId, path: prepared.path, name: f.name, type: f.type, size: f.size, isCurrentLogo: f.isCurrentLogo });
            if (!rec.ok) return false;
            setServerFiles((sf) => [...sf, { id: rec.id, name: f.name, type: f.type, isCurrentLogo: f.isCurrentLogo }]);
            await deleteFile(f.id);
            drop(f.id);
            return true;
          })().catch(() => false);
          setUploads((u) => u.map((x, j) => (j === i ? { ...x, status: ok ? "done" : "error" } : x)));
        }
      } finally {
        uploadRun.current = false;
      }
    },
    [],
  );

  // Entering the review: make sure the server draft is current, then upload any files.
  const enteredReview = useRef(false);
  useEffect(() => {
    if (step !== S.review || !state || enteredReview.current) return;
    enteredReview.current = true;
    startBusy(async () => {
      const saved = await persistDraft(state);
      if (saved.ok) await uploadPending(saved.contestId, state);
    });
  }, [step, state, persistDraft, uploadPending]);
  useEffect(() => {
    if (step !== S.review) enteredReview.current = false;
  }, [step]);

  if (!state) {
    return (
      <div className="flex w-full flex-1 flex-col px-3.5 pb-3.5 max-[720px]:px-2 max-[720px]:pb-2">
        <div className="min-h-96 flex-1 animate-pulse rounded-[32px] bg-frame max-[720px]:rounded-[24px]" aria-busy />
      </div>
    );
  }

  // ---- validity per step -----------------------------------------------------
  const isBriefStep = (BRIEF_STEPS as readonly number[]).includes(step);
  const briefErrors = isBriefStep ? validateBriefStep(step, state.brief, hidden) : {};
  // The owner's own questions on this step.
  const extraHere = isBriefStep ? extraOn(onboarding, step) : [];
  const extraErrors = extraHere.length ? checkExtraAnswers(onboarding, state.brief.extra, [step]).errors : {};
  const extraOk = Object.keys(extraErrors).length === 0;
  const uploading = uploads.some((u) => u.status === "uploading" || u.status === "waiting");
  const country = state.mobileCountry ?? "BD";
  // Step 1 (owner, 2026-10-15): the client's real name, mobile and email, so payments can be checked against the name.
  const personName = (state.name ?? "").trim().replace(/\s+/g, " ");
  const nameOk = isPersonName(personName) && personName.length >= 2 && personName.length <= NAME_MAX;
  const aboutOk = nameOk && toE164(state.mobile, country) !== null && normalizeEmail(state.email) !== null;
  const valid =
    step === S.you
      ? aboutOk
      : isBriefStep
        ? Object.keys(briefErrors).length === 0 && extraOk
        : step === S.prize
          ? price !== null && (Boolean(props.user) || password.length >= props.passwordMin)
          : method !== null && terms && !uploading && !busy && price !== null && Boolean(state.contestId);

  const index = steps.indexOf(step);
  const nextStep = fromReview && step < S.review ? S.review : steps[index + 1];

  const onNext = () => {
    if (!valid) return;
    // A new client's mobile for the team (owner, 2026-10-14): saved once step 1 is checked, then with the brand name.
    // With the name, email and WhatsApp tick from step 1 (owner, 2026-10-25), so the team knows who to call.
    const lead = () =>
      saveWizardLead({ visitId: wizardVisitId(), mobile: state.mobile, country, brandName: state.brief.brandName, service: "logo", name: personName, email: state.email, whatsapp: hidden.has("whatsapp") ? undefined : state.whatsapp === true });
    if (!props.user && step === S.logo) void lead();
    if (step === S.you) {
      startBusy(async () => {
        const res = await checkAccountDetails({ mobile: state.mobile, country, email: state.email });
        if (!res.ok) {
          const key = res.error.key;
          const phoneKeys = ["auth.errors.phoneTaken", "auth.errors.invalidPhone", "auth.errors.invalidPhoneIntl"];
          const fieldError = [...phoneKeys, "wizard.errors.emailTaken", "wizard.errors.email", "auth.errors.emailFake", "auth.errors.emailDisposable", "auth.errors.emailNoMail", "auth.errors.emailTypo"].includes(key);
          if (!fieldError) {
            // Not about either field (e.g. the database is down): show it in the general alert.
            setError(t(key, res.error.params));
            return;
          }
          setAccountError({
            field: phoneKeys.includes(key) ? "mobile" : "email",
            message: t(key, res.error.params),
            taken: key === "auth.errors.phoneTaken" || key === "wizard.errors.emailTaken",
          });
          return;
        }
        void lead();
        go(nextStep);
      });
      return;
    }
    if (step === S.prize && props.user) {
      startBusy(async () => {
        const saved = await persistDraft(state);
        // The reference photos wait on this device under the draft and upload at the review on the way back (owner,
        // 2026-10-22: leaving for the invite page used to lose them).
        if (saved.ok && props.inviteFirst) {
          savePending(saved.contestId, state.localFiles);
          return router.push(`/start/invite?draft=${saved.contestId}`);
        }
        if (saved.ok) go(S.review);
      });
      return;
    }
    if (step === S.prize) {
      startBusy(async () => {
        // Asks for notification permission while we still have the click (BLUEPRINT §12: welcome push).
        const push = await subscribeToPush();
        const res: WizardResult<{ contestId: string }> = await createAccountAndDraft({
          push,
          name: personName,
          mobile: state.mobile,
          country,
          whatsapp: state.whatsapp === true,
          password,
          email: state.email,
          brief: state.brief,
          order: state.order,
          acceptedContentRules: state.contentOk === true,
        });
        if (!res.ok) {
          // The mobile or email was taken in the meantime: back to step 1 to change it.
          if (res.error.key === "auth.errors.phoneTaken" || res.error.key === "wizard.errors.emailTaken") {
            setAccountError({ field: res.error.key === "auth.errors.phoneTaken" ? "mobile" : "email", message: t(res.error.key), taken: true });
            go(S.you);
            return;
          }
          setError(t(res.error.key, res.error.params));
          return;
        }
        // Meta Pixel: the client's account now exists (once: this branch runs only for a visitor).
        trackPixel(`register:${res.contestId}`, "CompleteRegistration");
        draftRef.current = res.contestId;
        setState((cur) => (cur ? { ...cur, contestId: res.contestId } : cur));
        if (props.shareSwitch) void setContestShare({ contestId: res.contestId, on: state.shareFb !== false });
        setPassword("");
        router.refresh(); // header and server props now see the signed-in client
        if (props.inviteFirst) {
          savePending(res.contestId, state.localFiles);
          return router.push(`/start/invite?draft=${res.contestId}`);
        }
        go(S.review);
      });
      return;
    }
    if (step === S.review) {
      // Pay pressed (not just saving the review): the team's live list hears "went to payment" and no help shows.
      setPaying(true);
      startBusy(async () => {
        // 9 = went to payment, on the drop-off chart (Admin › Dashboard).
        void recordWizardStep(wizardVisitId(), S.review + 1, state.contestId);
        const res = await startCheckout({ contestId: state.contestId!, method: method!, promo: promoNow?.code ?? null, acceptedTerms: terms, acceptedContentRules: Boolean(state.contentOk) }).catch((e: unknown) => {
          setPaying(false);
          throw e;
        });
        // On success the action redirects to the gateway, so we only get here on failure.
        if (res && !res.ok) {
          setPaying(false);
          setError(t(res.error.key, res.error.params));
        }
      });
      return;
    }
    if (nextStep === S.review) setFromReview(false);
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
      if (props.user && Object.keys(validateBriefStep(S.logo, state.brief)).length === 0) await persistDraft(state).catch(() => null);
      toast(t("wizard.frame.savedOnDevice"), "info");
      router.push("/");
    });
  };

  const goToFromReview = (s: number) => {
    setFromReview(true);
    go(s);
  };

  const briefProps: BriefStepProps = { brief: state.brief, update: updateBrief, errors: briefErrors, touched, touch, choices: props.choices, hidden };
  const lang = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en || x.bn);
  const key = HEADINGS[step];
  // A promo code was checked against the total at that moment; after the order changes it no longer counts.
  const promoNow = promo && price && promo.total + promo.saves === price.total ? promo : null;

  const showPrice = step >= S.prize && price !== null;
  const nextLabel =
    step === S.review && price ? t("wizard.c11.pay", { total: money(promoNow ? promoNow.total : price.total) }) : fromReview && step < S.review ? t("wizard.frame.backToReview") : t("wizard.frame.next");
  const accountErrors = {
    mobile:
      accountError?.field === "mobile" && !accountError.taken
        ? accountError.message
        : state.mobile.trim().length >= (country === "BD" ? 11 : 8) && !toE164(state.mobile, country)
          ? t(country === "BD" ? "auth.errors.invalidPhone" : "auth.errors.invalidPhoneIntl")
          : undefined,
    email:
      accountError?.field === "email" && !accountError.taken
        ? accountError.message
        : touchedAccount && state.email.includes("@") && state.email.length > 5 && !normalizeEmail(state.email)
          ? t("wizard.errors.email")
          : undefined,
  };

  return (
    <div ref={top} className="flex w-full flex-1 scroll-mt-32 flex-col px-3.5 pb-3.5 max-[720px]:px-2 max-[720px]:pb-2">
      {/* Owner, 2026-10-12: before a contest is made, the client agrees that it has no nude or sexual content. */}
      <Modal
        open={!state.contentOk}
        // Closing after "I agree" also fires this (the dialog's close event), so only leave when not agreed.
        onClose={() => {
          if (!state.contentOk) router.push("/");
        }}
        title={t("wizard.contentRules.title")}
        closeLabel={t("wizard.contentRules.leave")}
        footer={
          <div className="flex w-full flex-col gap-2">
            <Button block size="lg" onClick={() => setState({ ...state, contentOk: true })}>
              {t("wizard.contentRules.agree")}
            </Button>
            <Button block variant="ghost" onClick={() => router.push("/")}>
              {t("wizard.contentRules.leave")}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[15px] text-ink">{t("wizard.contentRules.body")}</p>
        <ul className="m-0 mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted">
          <li>{t("wizard.contentRules.r1")}</li>
          <li>{t("wizard.contentRules.r2")}</li>
          <li className="font-semibold text-[#A3121B]">{t("wizard.contentRules.r3")}</li>
        </ul>
      </Modal>
      {/* Grey page panel; on larger screens the step sits on a white card (site design, owner 2026-10-10) */}
      <div className="flex-1 rounded-[32px] bg-frame px-6 py-10 sm:px-10 max-[720px]:rounded-[24px] max-[720px]:bg-surface max-[720px]:px-4 max-[720px]:py-5">
        <div className={showPrice ? "mx-auto max-w-[68rem] lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8" : ""}>
          <div className="mx-auto w-full max-w-2xl min-[721px]:rounded-[28px] min-[721px]:border min-[721px]:border-line min-[721px]:bg-surface min-[721px]:p-10 min-[721px]:shadow-card">
            {/* Wizard frame: back arrow, stepper, Save & exit */}
            <div className="mb-8 flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                aria-label={t("wizard.frame.back")}
                className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-line bg-surface text-ink transition-colors hover:bg-chip"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="flex-1">
                <Stepper current={index + 1} total={steps.length} label={t("common.stepOf", { current: index + 1, total: steps.length })} />
              </div>
              <button type="button" onClick={onSaveExit} className="min-h-11 shrink-0 rounded-[14px] px-3 text-sm font-bold text-primary transition-colors hover:bg-tint">
                {t("wizard.frame.saveExit")}
              </button>
            </div>

            {/* Each step slides in when it changes (UI-JOURNEY §1.5) */}
            <div key={step} className="animate-step-in">
              <h1 className="m-0 text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">{t(`wizard.${key}.heading` as MessageKey)}</h1>
              <p className="mb-7 mt-2.5 text-[17px] leading-relaxed text-muted">{t(`wizard.${key}.helper` as MessageKey, { max: props.fileLimits.maxFiles, mb: props.fileLimits.maxMb })}</p>

              {step === S.logo && props.user && props.previous.length > 0 && !state.brief.businessDescription && (
                <PreviousBriefs previous={props.previous} onUse={(b) => updateBrief({ ...b })} />
              )}

              {/* 1. About you (new clients): real name for the payment check, mobile and email (owner, 2026-10-15) */}
              {step === S.you && (
                <div className="space-y-5">
                  <TextField
                    mark
                    label={t("wizard.you.nameLabel")}
                    hint={t("wizard.you.nameHint")}
                    autoComplete="name"
                    value={state.name ?? ""}
                    maxLength={NAME_MAX}
                    onChange={(e) => setState((cur) => (cur ? { ...cur, name: e.target.value } : cur))}
                    onBlur={() => touch("name")}
                    error={touched.has("name") && personName && !nameOk ? t("wizard.you.nameError") : undefined}
                    autoFocus
                  />
                  <AccountStep
                    mobile={state.mobile}
                    email={state.email}
                    country={country}
                    onCountry={(iso) => {
                      setState({ ...state, mobileCountry: iso });
                      setAccountError(null);
                    }}
                    whatsapp={state.whatsapp === true}
                    onWhatsapp={hidden.has("whatsapp") ? undefined : (on) => setState({ ...state, whatsapp: on })}
                    onMobile={(mobile) => {
                      setState({ ...state, mobile });
                      setAccountError(null);
                    }}
                    onEmail={(email) => {
                      setState({ ...state, email });
                      setAccountError(null);
                      setTouchedAccount(true);
                    }}
                    mobileError={accountErrors.mobile}
                    emailError={accountErrors.email}
                    taken={Boolean(accountError?.taken)}
                    autoFocus={false}
                  />
                </div>
              )}
              {step === S.logo && <BrandStep {...briefProps} />}
              {step === S.business && <BusinessStep {...briefProps} />}
              {step === S.links && <LinksStep {...briefProps} />}
              {step === S.look && <LookStep {...briefProps} />}
              {step === S.needs && <NeedsStep {...briefProps} />}
              {step === S.needs && !hidden.has("files") && (
                <div className="mt-10">
                  <Part title={t("wizard.c07.heading")} sub={t("wizard.c07.helper", { max: props.fileLimits.maxFiles, mb: props.fileLimits.maxMb })}>
                    <FilesStep
                      localFiles={state.localFiles}
                      serverFiles={serverFiles}
                      limits={props.fileLimits}
                      // Only the list changes, from its current value: a pick that ends late undoes nothing (owner, 2026-10-22).
                      onChange={(change) => setState((cur) => (cur ? { ...cur, localFiles: change(cur.localFiles) } : cur))}
                      onRemoveServerFile={(id) =>
                        startBusy(async () => {
                          if (state.contestId) await removeBriefFile({ contestId: state.contestId, fileId: id });
                          setServerFiles((f) => f.filter((x) => x.id !== id));
                        })
                      }
                    />
                  </Part>
                </div>
              )}
              {/* The owner's own questions on this step (Admin › Onboarding, owner 2026-10-14) */}
              {extraHere.length > 0 && (
                <div className="mt-6 space-y-5">
                  {extraHere.map((q) => (
                    <FieldInput
                      key={q.key}
                      f={q}
                      l={lang}
                      value={state.brief.extra?.[q.key]}
                      onChange={(v) => {
                        updateBrief({ extra: { ...(state.brief.extra ?? {}), [q.key]: v } });
                        touch(`extra.${q.key}`);
                      }}
                      error={touched.has(`extra.${q.key}`) && extraErrors[q.key] ? t(`services.wizard.errors.${extraErrors[q.key]}` as MessageKey) : undefined}
                    />
                  ))}
                </div>
              )}
              {step === S.prize && <PackageStep order={state.order} update={updateOrder} config={props.pricing} />}
              {step === S.prize && props.shareSwitch && (
                <div className="mt-4">
                  <ShareOnFacebook on={state.shareFb !== false} isPrivate={state.order.upgrades.private || state.order.upgrades.nda} onChange={(on) => setState((cur) => (cur ? { ...cur, shareFb: on } : cur))} />
                </div>
              )}
              {/* A new client sets a password with the prize (owner, 2026-10-15); the account is made on Next. */}
              {step === S.prize && !props.user && (
                <div className="mt-10">
                  <Part title={t("wizard.c10.heading")} sub={t("wizard.c10.helper")}>
                    <PasswordStep password={password} onPassword={setPassword} min={props.passwordMin} autoFocus={false} />
                  </Part>
                </div>
              )}
              {step === S.review && price && (
                <ReviewStep
                  brief={state.brief}
                  order={state.order}
                  price={price}
                  feePercent={price?.feePercent ?? props.pricing.serviceFeePercent}
                  methods={props.methods}
                  method={method}
                  onMethod={setMethod}
                  promo={promoNow}
                  onApplyPromo={async (code) => {
                    const res = await previewPromo({ contestId: state.contestId!, code });
                    if (!res.ok) return { ok: false, error: t(res.error.key, res.error.params) };
                    setPromo(res);
                    return { ok: true };
                  }}
                  onRemovePromo={() => setPromo(null)}
                  terms={terms}
                  onTerms={setTerms}
                  guarantee={props.guarantee ?? null}
                  addonsFreeFrom={props.pricing.addonsFreeFrom ?? 0}
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
            {helpSpace > 0 && <div aria-hidden style={{ height: helpSpace }} />}
            {videoSpace > helpSpace && <div aria-hidden style={{ height: videoSpace - helpSpace }} />}
            <div ref={bar} className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur min-[721px]:static min-[721px]:mx-0 min-[721px]:border-0 min-[721px]:bg-transparent min-[721px]:px-0 min-[721px]:pt-0">
              {showPrice && <PriceBar key={step} price={price} feePercent={price?.feePercent ?? props.pricing.serviceFeePercent} />}
              <Button size="lg" block onClick={onNext} disabled={!valid} loading={busy}>
                {nextLabel}
              </Button>
              {step === S.review && <p className="mt-2 text-center text-xs text-muted">{t("wizard.c11.secureNote")}</p>}
              <p className="mt-2 text-center text-xs text-muted">{t("wizard.frame.savedOnDevice")}</p>
            </div>
          </div>

          {showPrice && <PriceSidebar price={price} feePercent={price?.feePercent ?? props.pricing.serviceFeePercent} />}
        </div>
      </div>
      {/* Not while the content rules are open, and never once Pay is pressed (owner, 2026-10-25). */}
      <HelpCard offer={live.offer} act={live.act} onClose={live.close} hidden={!state.contentOk || paying} above={bar} onSpace={setHelpSpace} />
      {/* Once the content rules are agreed; out of the way on Review and pay (owner, 2026-10-26). */}
      <StartVideoCorner video={props.video ?? null} ready={state.contentOk === true} atPay={step === S.review} hidden={paying} helpShown={helpSpace > 0} above={bar} onSpace={setVideoSpace} />
    </div>
  );
}

/** Never land past the first unfinished step (e.g. a stale ?step=8 link). */
function firstReachable(wanted: number, s: WizardState, steps: number[], cfg: PricingConfig, onboarding: OnboardingConfig = EMPTY_ONBOARDING): number {
  const hidden = new Set(onboarding.hidden);
  for (const st of steps) {
    if (st >= wanted) return steps.includes(wanted) ? wanted : st;
    const incomplete =
      st === S.you
        ? true // the mobile and email are checked again on Next
        : (BRIEF_STEPS as readonly number[]).includes(st)
          ? Object.keys(validateBriefStep(st, s.brief, hidden)).length > 0 || Object.keys(checkExtraAnswers(onboarding, s.brief.extra, [st]).errors).length > 0
          : st === S.prize
            ? validateOrder(s.order, cfg) !== null || !s.contestId
            : false;
    if (incomplete) return st;
  }
  return steps[steps.length - 1];
}

function PreviousBriefs({ previous, onUse }: { previous: WizardProps["previous"]; onUse: (b: Brief) => void }) {
  const { t } = useI18n();
  return (
    <div className="mb-7 rounded-[20px] bg-tint p-4">
      <p className="m-0 text-sm font-bold text-ink">{t("wizard.previous.title")}</p>
      <ul className="m-0 mt-2 list-none divide-y divide-primary/10 p-0">
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

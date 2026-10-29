"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { HelpCard } from "@/components/wizard/help-card";
import { useWizardLive } from "@/components/wizard/use-wizard-live";
import { wizardVisitId } from "@/components/wizard/visit-id";
import { emptyBrief, type BusinessType, type Order } from "@/lib/contests/brief";
import { defaultOrder, type PricingConfig } from "@/lib/contests/pricing";
import { useI18n } from "@/lib/i18n/client";
import { v2Account, v2OpenPayment, v2SaveBasics, v2SaveOrder, v2ViewPricing } from "@/lib/onboarding/v2-actions";
import { V2, V2_STAGE, V2_TOTAL, v2CanGo } from "@/lib/onboarding/v2-steps";
import { subscribeToPush } from "@/lib/push/client";
import { recordWizardStep, saveWizardLead } from "@/lib/wizard-tracking";
import { logoLiveAnswers } from "@/lib/wizard-live-rules";
import { AccountV2 } from "./step-account";
import { BasicsV2 } from "./step-basics";
import { DoneV2 } from "./success";
import { PayV2 } from "./step-pay";
import { PrizeV2 } from "./step-prize";

/** The server side the wizard talks to; a local preview passes stand-ins so nothing is saved. */
export type V2Actions = {
  account: typeof v2Account;
  basics: typeof v2SaveBasics;
  viewPricing: typeof v2ViewPricing;
  saveOrder: typeof v2SaveOrder;
  openPayment: typeof v2OpenPayment;
  push: () => Promise<unknown>;
  track: (step: number, contestId: string | null) => void;
  lead: (input: { mobile: string; country: string; name: string; email: string; whatsapp: boolean }) => void;
};

const SERVER: V2Actions = {
  account: v2Account,
  basics: v2SaveBasics,
  viewPricing: v2ViewPricing,
  saveOrder: v2SaveOrder,
  openPayment: v2OpenPayment,
  push: subscribeToPush,
  track: (step, contestId) => void recordWizardStep(wizardVisitId("v2"), step, contestId, "v2"),
  // A new client's number for the team even if signing up stops here (owner, 2026-10-14), like the old wizard.
  lead: (i) => void saveWizardLead({ visitId: wizardVisitId("v2"), service: "logo", ...i }),
};

const AGREED_KEY = "lc-v2-agreed";
function agreedOnStep1(): boolean {
  try {
    return sessionStorage.getItem(AGREED_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberAgreedOnStep1() {
  try {
    sessionStorage.setItem(AGREED_KEY, "1");
  } catch {
    // Private mode: the step-2 tick shows again, which only asks once more.
  }
}

export type WizardV2Props = {
  signedIn: boolean;
  pricing: PricingConfig;
  passwordMin: number;
  approvalMinutes: number;
  /** The team's WhatsApp, with the price question filled in (step 3). */
  whatsapp: string;
  /** Admin › Lists: business types in order, hidden ones left out. */
  businessTypes: string[];
  /** The client's v2 contest that is reopened, if any. */
  resume: {
    contestId: string;
    slug: string;
    brandName: string;
    businessType: BusinessType | "";
    businessTypeOther: string;
    order: Order;
    lastStep: number | null;
    agreed: boolean;
    waiting: boolean;
  } | null;
  initialStep: number;
  actions?: Partial<V2Actions>;
};

/**
 * Onboarding v2 (owner, 2026-10-28; client-onboarding-v2-spec.md): 1 about you, 2 logo name and business type, 3 prize,
 * length and add-ons, 4 bKash payment, then thanks. Each step is saved on the server as it is finished (the prize step
 * as the client picks), so leaving and coming back carries on at the right step. One column, no pop-ups.
 */
export function WizardV2(props: WizardV2Props) {
  const { t } = useI18n();
  const router = useRouter();
  const actions = useMemo(() => ({ ...SERVER, ...props.actions }), [props.actions]);
  const r = props.resume;

  const [step, setStep] = useState(props.initialStep);
  const signedIn = props.signedIn;
  // Signed in before opening the wizard. Signing up on step 1 reloads the page's data and starts the wizard afresh
  // (the client workspace frame appears), so the tick given on step 1 is remembered in this tab.
  const [startedSignedIn] = useState(props.signedIn);
  const [agreedHere, setAgreedHere] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
    if (agreedOnStep1()) setAgreedHere(true);
  }, []);
  // Ticked on step 1 (pre-ticked, spec §2); a client who was already signed in ticks it on step 2.
  const [agreed, setAgreed] = useState(r?.agreed ?? true);
  const [contestId, setContestId] = useState<string | null>(r?.contestId ?? null);
  const [slug, setSlug] = useState(r?.slug ?? "");
  const [brandName, setBrandName] = useState(r?.brandName ?? "");
  const [businessType, setBusinessType] = useState<BusinessType | "">(r?.businessType ?? "");
  const [businessTypeOther, setBusinessTypeOther] = useState(r?.businessTypeOther ?? "");
  const [order, setOrder] = useState<Order>(r?.order ?? defaultOrder(props.pricing));
  const [sent, setSent] = useState(r?.waiting ?? false);
  const [error, setError] = useState<string | null>(null);
  const [helpSpace, setHelpSpace] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  // The current step's buttons, for the team's help card (it keeps clear of them and gives them focus back).
  const bar = useRef<HTMLDivElement | null>(null);
  const setBar = useCallback((el: HTMLDivElement | null) => {
    bar.current = el;
  }, []);
  const can = useCallback((to: number) => v2CanGo(to, { signedIn, contestId, sent }), [signedIn, contestId, sent]);

  // The address keeps the step and the contest, so a reload or Back reopens the same one.
  const url = useCallback((to: number, id: string | null) => `?${new URLSearchParams({ ...(id ? { draft: id } : {}), step: String(to) })}`, []);
  useEffect(() => {
    window.setTimeout(() => window.history.replaceState({ step }, "", url(step, contestId)), 0);
    // Once, on the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback(
    (to: number, id: string | null = contestId, replace = false) => {
      setStep(to);
      setError(null);
      window.history[replace ? "replaceState" : "pushState"]({ step: to }, "", url(to, id));
      top.current?.scrollIntoView({ block: "start" });
    },
    [contestId, url],
  );

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      // Back that leaves the wizard is the browser's own: the page it goes to keeps its address.
      if (window.location.pathname !== "/start-v2") return;
      const to = (e.state as { step?: number } | null)?.step ?? Number(new URLSearchParams(window.location.search).get("step"));
      // Back only: Forward never skips a step's Next, which is what saves it.
      if (to && to <= step && can(to)) setStep(to);
      else window.history.replaceState({ step }, "", url(step, contestId));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [can, step, contestId, url]);

  // Drop-off for the team (v2's own steps, kept apart from the old wizard's), no personal data.
  useEffect(() => {
    actions.track(step, contestId);
  }, [step, contestId, actions]);

  // "Creating a contest right now" on Admin › Unpaid contests, and the one help message the team may send.
  const answers = useMemo(() => logoLiveAnswers({ ...emptyBrief(), brandName, businessType }, order, 0), [brandName, businessType, order]);
  const live = useWizardLive({ on: true, service: "logo", stage: V2_STAGE[step] ?? 1, pos: Math.min(step, V2_TOTAL), of: V2_TOTAL, contestId, answers, flow: "v2" });

  const back = () => {
    if (step === V2.prize) return go(V2.basics);
    if (step === V2.pay) return go(V2.prize);
    if (step === V2.basics && !signedIn) return go(V2.account);
    router.push("/");
  };

  const heading: Record<number, string> = { 1: "account", 2: "basics", 3: "prize", 4: "pay", 5: "done" };
  const key = heading[step];

  return (
    <div ref={top} className="flex w-full flex-1 scroll-mt-32 flex-col px-3.5 pb-3.5 max-[720px]:px-2 max-[720px]:pb-2">
      <div className="flex-1 rounded-[32px] bg-frame px-6 py-8 sm:px-10 sm:py-10 max-[720px]:rounded-[24px] max-[720px]:bg-surface max-[720px]:px-4 max-[720px]:py-5">
        <div className="mx-auto w-full max-w-[560px] min-[721px]:rounded-2xl min-[721px]:border min-[721px]:border-line min-[721px]:bg-surface min-[721px]:p-8 min-[721px]:shadow-card">
          {step <= V2.pay ? (
            <div className="mb-6" data-progress={step}>
              <p className="m-0 text-[13px] font-bold text-muted">{t("wizardV2.progress", { n: step, total: V2_TOTAL })}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(step / V2_TOTAL) * 100}%` }} />
              </div>
            </div>
          ) : (
            <span className="mb-5 inline-flex rounded-full bg-success/10 px-3 py-1 text-[13px] font-bold text-success">{t("wizardV2.done.badge")}</span>
          )}

          <div key={step} className="animate-step-in">
            {step !== V2.done && (
              <>
                <h1 className="m-0 text-[clamp(26px,3.2vw,34px)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">{t(`wizardV2.${key as "account"}.heading`)}</h1>
                {/* The payment step writes its own line, with the amount once the payment is ready. */}
                {step !== V2.pay && (
                  <p className="mb-6 mt-2 text-[16px] leading-relaxed text-muted">{step === V2.prize ? t("wizardV2.prize.helper", { name: brandName }) : t(`wizardV2.${key as "account"}.helper`)}</p>
                )}
              </>
            )}

            {step === V2.account && (
              <AccountV2
                actions={actions}
                passwordMin={props.passwordMin}
                agreed={agreed}
                onAgreed={setAgreed}
                onError={setError}
                onBar={setBar}
                onDone={() => {
                  rememberAgreedOnStep1();
                  // A fresh page, now signed in (the client workspace frame appears): it opens at the logo name, or at
                  // the client's unpaid contest, instead of the old page being swapped out while they type.
                  window.location.replace("/start-v2");
                }}
              />
            )}
            {step === V2.basics && (
              <BasicsV2
                actions={actions}
                contestId={contestId}
                businessTypes={props.businessTypes}
                brandName={brandName}
                onBrandName={setBrandName}
                businessType={businessType}
                onBusinessType={setBusinessType}
                businessTypeOther={businessTypeOther}
                onBusinessTypeOther={setBusinessTypeOther}
                // Signed in before starting: step 1 was skipped, so the agreement is ticked here.
                askAgreement={startedSignedIn && !r?.agreed && !agreedHere}
                agreed={agreed}
                onAgreed={setAgreed}
                onError={setError}
                onBack={back}
                onBar={setBar}
                onDone={(saved) => {
                  setContestId(saved.contestId);
                  setSlug(saved.slug);
                  go(V2.prize, saved.contestId);
                }}
              />
            )}
            {step === V2.prize && contestId && (
              <PrizeV2 actions={actions} contestId={contestId} config={props.pricing} order={order} onOrder={setOrder} whatsapp={props.whatsapp} onBar={setBar} onError={setError} onBack={back} onDone={() => go(V2.pay)} />
            )}
            {step === V2.pay && contestId && (
              <PayV2
                actions={actions}
                contestId={contestId}
                brandName={brandName}
                order={order}
                approvalMinutes={props.approvalMinutes}
                onBar={setBar}
                onBack={back}
                onDone={() => {
                  setSent(true);
                  go(V2.done, contestId, true);
                }}
              />
            )}
            {step === V2.done && contestId && <DoneV2 contestId={contestId} slug={slug} brandName={brandName} />}
          </div>

          {error && (
            <div className="mt-5">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          {helpSpace > 0 && <div aria-hidden style={{ height: helpSpace }} />}
        </div>
      </div>
      <HelpCard offer={live.offer} act={live.act} onClose={live.close} hidden={sent} above={bar} onSpace={setHelpSpace} />
    </div>
  );
}

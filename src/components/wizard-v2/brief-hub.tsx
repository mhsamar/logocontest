"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { useToast } from "@/components/ui/toast";
import { FieldInput } from "@/components/services/field-input";
import { BrandStep, BusinessStep, LinksStep, LookStep, NeedsStep, type BriefChoices, type BriefStepProps } from "@/components/wizard/steps-brief";
import { briefLinks, cleanBrief, validateBriefStepV2, type Brief, type FieldErrors } from "@/lib/contests/brief";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { v2AcceptBrief, v2SaveBriefSection } from "@/lib/onboarding/brief-actions";
import { BRIEF_SECTIONS, HUB_FIELDS, SECTION_STEPS, type BriefCompletion, type BriefSection } from "@/lib/onboarding/brief-defaults";
import { checkExtraAnswers, extraOn, type OnboardingConfig } from "@/lib/onboarding/config";
import type { Lang } from "@/lib/services/types";
import type { ServerFile } from "@/components/wizard/state";
import { HubPhotos, type PhotoActions } from "./hub-photos";

/** The server side; a local preview passes stand-ins so nothing is saved. */
export type HubActions = { save: typeof v2SaveBriefSection; accept: typeof v2AcceptBrief };
const SERVER: HubActions = { save: v2SaveBriefSection, accept: v2AcceptBrief };

/** A step: one part of the brief, then the pictures and Pro invitations together. */
type Step = BriefSection | "extras";

// The "none yet" ticks aren't stored, and start unticked so the link rows and the competitors box are both in view
// (owner, 2026-10-30: with competitors hidden behind a tick, other businesses' sites went in as the client's own).
// Empty rows and boxes are dropped when saved.
const withTicks = (b: Brief): Brief => ({ ...b, noLinks: false, noCompetitors: false });
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Onboarding v2's brief after paying (owner, 2026-10-29; spec §3), already filled in from the business type. One part
 * at a time (owner, 2026-10-30: "ak page a sob gula na dea, single single or 2 ta segment segment step"): business,
 * links and competitors, styles and colours, use and needs, each with the old wizard's own fields open, then the
 * reference pictures and Pro invitations together, and "Looks right, finish". A part is saved on Next only when
 * something in it changed; a changed part is the client's, the rest stay defaults.
 */
export function BriefHub(props: {
  contestId: string;
  slug: string;
  brief: Brief;
  completion: BriefCompletion;
  live: boolean;
  paid: boolean;
  choices: BriefChoices;
  onboarding: OnboardingConfig;
  invites: boolean;
  /** The reference pictures and their limits; null when Admin › Onboarding hides them. */
  photos: { files: ServerFile[]; limits: { maxFiles: number; maxMb: number } } | null;
  actions?: Partial<HubActions>;
  photoActions?: Partial<PhotoActions>;
  /** Open on the pictures and invitations (the client page's "Add photos", back from inviting Pro designers). */
  initialStep?: "extras";
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const actions = useMemo(() => ({ ...SERVER, ...props.actions }), [props.actions]);
  const hidden = useMemo(() => new Set(props.onboarding.hidden), [props.onboarding]);
  // Card 1 is the slogan, description and customers only (owner, 2026-10-29): the logo name and business type were
  // given on the wizard's step 2, and a new type would change the other cards' defaults.
  const hiddenBusiness = useMemo(() => new Set([...props.onboarding.hidden, "brandName", "businessType", "logoText", "shortName"]), [props.onboarding]);
  // Card 3 is the logo styles and colours, without the feel sliders (owner, 2026-10-29: "aitao remove koro").
  const hiddenLook = useMemo(() => new Set([...props.onboarding.hidden, "sliders"]), [props.onboarding]);
  const [brief, setBrief] = useState(props.brief);
  const [edited, setEdited] = useState<BriefSection[]>(props.completion.edited);
  const steps = useMemo<Step[]>(() => [...BRIEF_SECTIONS, ...(props.photos || props.invites ? (["extras"] as const) : [])], [props.photos, props.invites]);
  const [at, setAt] = useState(() => (props.initialStep === "extras" ? Math.max(0, steps.indexOf("extras")) : 0));
  // Steps the client has been on: green on the bar.
  const [seen, setSeen] = useState(() => new Set([at]));
  const step = steps[at];
  const last = at === steps.length - 1;
  // The part of the brief on this step, its fields open from the start.
  const open: BriefSection | null = step === "extras" ? null : step;
  const [photosOpen, setPhotosOpen] = useState(false);
  // Pictures picked or removed in the photo card and not saved yet.
  const [photosDirty, setPhotosDirty] = useState(false);
  const [draft, setDraft] = useState<Brief>(() => withTicks(props.brief));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [extraErrors, setExtraErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const lang = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en || x.bn);
  const digit = (n: number) => (locale === "bn" ? String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : String(n));
  const headRef = useRef<HTMLHeadingElement>(null);
  const barRef = useRef<HTMLElement>(null);

  // Something changed in this step that isn't saved yet (owner, 2026-10-30: it used to vanish without a word). A "none
  // yet" tick counts when it takes away links or competitors that are saved; on its own it is no change.
  const tickClears = open === "links" && ((draft.noLinks && briefLinks(brief).length > 0) || (draft.noCompetitors && brief.competitors.trim() !== ""));
  const cardDirty =
    open !== null &&
    (tickClears || HUB_FIELDS[open].some((f) => !same(draft[f], brief[f])) || props.onboarding.extra.some((q) => SECTION_STEPS[open].includes(q.step) && !same(draft.extra?.[q.key], brief.extra?.[q.key])));
  const dirty = cardDirty || photosDirty;
  const unsaved = t("wizardV2.hub.unsaved");
  // Leaving the page with unsaved typing or pictures asks first: closing or reloading the tab, and any link (the client
  // menu, the top bar, Invite, "Later"), as those change the page without a reload.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onLink = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (window.confirm(unsaved)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onLink, true);
    };
  }, [dirty, unsaved]);
  const clear = () => {
    setTouched(new Set());
    setServerErrors({});
    setExtraErrors({});
    setError(null);
  };
  // Step `to`, with the brief as saved; the page goes back to the step bar, and the step's title gets the focus.
  const show = (to: number, saved: Brief) => {
    setAt(to);
    setSeen((s) => new Set(s).add(to));
    setDraft(withTicks(saved));
    clear();
    requestAnimationFrame(() => {
      barRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      headRef.current?.focus({ preventScroll: true });
    });
  };
  // Undo: this step back to what is saved.
  const undo = () => (setDraft(withTicks(brief)), clear());
  // What is wrong now (shown under the fields), plus the server's answer to the last save until those fields change.
  const checkNow = (s: BriefSection): FieldErrors => Object.assign({}, ...SECTION_STEPS[s].map((step) => validateBriefStepV2(step, draft)));
  const errorsFor = (s: BriefSection): FieldErrors => ({ ...serverErrors, ...checkNow(s) });

  // Saves this step's part, then `then` with the brief as kept. A problem stays on this step and says where.
  const save = (s: BriefSection, then: (kept: Brief) => void | Promise<void>) => {
    const errors = checkNow(s);
    const asked = props.onboarding.extra.filter((q) => SECTION_STEPS[s].includes(q.step));
    const extraCheck = asked.length ? checkExtraAnswers(props.onboarding, draft.extra, SECTION_STEPS[s]).errors : {};
    if (Object.keys(errors).length || Object.keys(extraCheck).length) {
      // Show every problem on this step at once, say so by the button and go to the first one (owner, 2026-10-30: a
      // small red line under one field looked like nothing happened).
      setTouched(new Set([...Object.keys(errors), ...Object.keys(extraCheck).map((k) => `extra.${k}`)]));
      setExtraErrors(extraCheck);
      setError(t("wizardV2.hub.fixAbove"));
      requestAnimationFrame(() => {
        const bad = document.querySelector<HTMLElement>(`[data-section="${s}"] [aria-invalid="true"]`);
        // Fields without aria-invalid (link rows, the owner's own questions): their red message instead.
        const target = bad ?? document.querySelector<HTMLElement>(`[data-section="${s}"] [role="alert"]`);
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
        bad?.focus({ preventScroll: true });
      });
      return;
    }
    setError(null);
    start(async () => {
      const part = Object.fromEntries(HUB_FIELDS[s].map((f) => [f, draft[f]])) as Partial<Brief>;
      // A lost connection stays on this step with what was typed (it would otherwise replace the page with an error).
      const res = await actions.save({ contestId: props.contestId, section: s, brief: s === "links" ? { ...part, noLinks: draft.noLinks, noCompetitors: draft.noCompetitors } : part, extra: draft.extra }).catch(() => null);
      if (!res) return setError(t("wizardV2.hub.offline"));
      if (!res.ok) {
        setServerErrors(res.errors ?? {});
        setExtraErrors(res.extraErrors ?? {});
        if (res.errors || res.extraErrors) setTouched(new Set([...Object.keys(res.errors ?? {}), ...Object.keys(res.extraErrors ?? {}).map((k) => `extra.${k}`)]));
        // The wizard's "go back and check" makes no sense here: point at this step instead.
        return setError(t(res.error === "wizard.errors.incomplete" ? "wizardV2.hub.fixAbove" : res.error));
      }
      // What the server kept (empty rows dropped, "none yet" honoured), so the next visit to this step matches it.
      const kept = cleanBrief(draft);
      setBrief(kept);
      setDraft(withTicks(kept));
      setEdited(res.edited);
      toast(t("wizardV2.hub.saved"), "success");
      await then(kept);
    });
  };
  // Next, Back or a step on the bar: what changed on this step is saved first. (Not while the photo card is open: its
  // pictures are saved or put back before the client can leave that step.)
  const go = (to: number) => (open && cardDirty ? save(open, (kept) => show(to, kept)) : show(to, brief));

  const accept = async () => {
    const res = await actions.accept({ contestId: props.contestId }).catch(() => null);
    if (!res) return setError(t("wizardV2.hub.offline"));
    if (!res.ok) return setError(t(res.error));
    // To the brief, where "Edit brief" brings the client back here (owner, 2026-10-30).
    router.push(`/client/contests/${props.slug}?tab=brief`);
  };
  // The last step: its changes first, then finish.
  const finish = () => (open && cardDirty ? save(open, accept) : start(accept));

  const label = (s: Step) => (s !== "extras" ? t(`wizardV2.hub.cards.${s}`) : props.photos && props.invites ? t("wizardV2.hub.cards.extras") : t(props.photos ? "wizardV2.hub.cards.photos" : "wizardV2.hub.cards.invite"));
  const editor = (s: BriefSection) => {
    const errors = errorsFor(s);
    const p: BriefStepProps = {
      brief: draft,
      update: (patch) => {
        setDraft((d) => ({ ...d, ...patch }));
        // A field changed since the last save: the server's old complaint about it no longer applies.
        setServerErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))));
      },
      errors,
      touched,
      touch: (f) => setTouched((x) => (x.has(f) ? x : new Set(x).add(f))),
      choices: props.choices,
      hidden,
    };
    const extras = SECTION_STEPS[s].flatMap((step) => extraOn(props.onboarding, step));
    return (
      <div className="space-y-6">
        {s === "business" && (
          <>
            <BrandStep {...p} hidden={hiddenBusiness} />
            <BusinessStep {...p} hidden={hiddenBusiness} />
          </>
        )}
        {s === "links" && <LinksStep {...p} />}
        {s === "look" && <LookStep {...p} hidden={hiddenLook} />}
        {s === "needs" && <NeedsStep {...p} />}
        {extras.map((q) => (
          <FieldInput
            key={q.key}
            f={q}
            l={lang}
            value={draft.extra?.[q.key]}
            onChange={(v) => {
              setDraft((d) => ({ ...d, extra: { ...(d.extra ?? {}), [q.key]: v } }));
              setExtraErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== q.key)));
              p.touch(`extra.${q.key}`);
            }}
            error={touched.has(`extra.${q.key}`) && extraErrors[q.key] ? t(`services.wizard.errors.${extraErrors[q.key]}` as MessageKey) : undefined}
          />
        ))}
      </div>
    );
  };

  const typeLabel = brief.businessType ? t(`wizard.businessTypes.${brief.businessType}`) : "";
  const mine = open !== null && edited.includes(open);

  return (
    <div className="flex w-full flex-1 flex-col px-3.5 pb-3.5 max-[720px]:px-2 max-[720px]:pb-2">
      <div className="flex-1 rounded-[32px] bg-frame px-6 py-8 sm:px-10 sm:py-10 max-[720px]:rounded-[24px] max-[720px]:bg-surface max-[720px]:px-4 max-[720px]:py-5">
        <div className="mx-auto w-full max-w-[560px] min-[721px]:rounded-2xl min-[721px]:border min-[721px]:border-line min-[721px]:bg-surface min-[721px]:p-8 min-[721px]:shadow-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-chip px-3 py-1 text-[13px] font-bold text-muted">{t("wizardV2.optional")}</span>
            {props.paid && <span className="rounded-full bg-success/10 px-3 py-1 text-[13px] font-bold text-success">{props.live ? t("wizardV2.hub.live") : t("wizardV2.done.badge")}</span>}
          </div>
          <h1 className="m-0 text-[clamp(26px,3.2vw,34px)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">{t("wizardV2.hub.title")}</h1>
          {at === 0 && <p className="m-0 mt-2 text-[16px] leading-relaxed text-muted">{t("wizardV2.hub.body", { type: typeLabel })}</p>}

          {/* Where the client is; a step on the bar goes there (this step's changes are saved first). */}
          <nav ref={barRef} aria-label={t("wizardV2.hub.stepsLabel")} className="mt-5 scroll-mt-24">
            <p className="m-0 text-[13px] font-bold text-muted">{t("wizardV2.hub.stepOf", { n: digit(at + 1), total: digit(steps.length) })}</p>
            <ol className="m-0 mt-1 flex list-none gap-1.5 p-0">
              {steps.map((s, i) => (
                <li key={s} className="flex-1">
                  <button type="button" onClick={() => i !== at && go(i)} disabled={busy || photosOpen} aria-current={i === at ? "step" : undefined} aria-label={`${digit(i + 1)} · ${label(s)}`} title={label(s)} className="flex min-h-11 w-full items-center disabled:cursor-default">
                    <span className={cx("h-1.5 w-full rounded-full", i === at ? "bg-primary" : seen.has(i) ? "bg-success" : "bg-line")} />
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <section className="mt-2" data-section={step}>
            <h2 ref={headRef} tabIndex={-1} className="m-0 mb-5 flex flex-wrap items-center gap-2 text-[20px] font-semibold text-ink outline-none">
              {digit(at + 1)} · {label(step)}
              {open && <span className={cx("rounded-full px-2 py-0.5 text-[11.5px] font-bold", mine ? "bg-success/10 text-success" : "bg-chip text-muted")}>{mine ? t("wizardV2.hub.yoursTag") : t("wizardV2.hub.defaultTag")}</span>}
            </h2>
            {/* Nothing can be typed while a step is being saved, so nothing typed meanwhile is lost. */}
            {open && <fieldset disabled={busy} className="m-0 min-w-0 border-0 p-0">{editor(open)}</fieldset>}
            {/* Always there (hidden on the other steps), so the photo card keeps what it saved when the client comes back. */}
            {(props.photos || props.invites) && (
              <div hidden={step !== "extras"} className="flex flex-col gap-3">
                {props.photos && <HubPhotos contestId={props.contestId} files={props.photos.files} limits={props.photos.limits} onOpen={setPhotosOpen} onDirty={setPhotosDirty} actions={props.photoActions} inStep />}
                {props.invites && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
                    <div>
                      <h3 className="m-0 text-[16px] font-semibold text-ink">{t("wizardV2.hub.cards.invite")}</h3>
                      <p className="m-0 mt-1 text-[14px] text-muted">{t("wizardV2.hub.inviteLine")}</p>
                    </div>
                    <ButtonLink href={`/start/invite?draft=${props.contestId}&from=hub`} variant="secondary" className="shrink-0 whitespace-nowrap">
                      {t("wizardV2.hub.invite")}
                    </ButtonLink>
                  </div>
                )}
              </div>
            )}
          </section>

          {error && (
            <div className="mt-5">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2">
            {/* Not while the photo card is open: its pictures aren't saved yet. */}
            <Button type="button" size="lg" block loading={busy} disabled={photosOpen} onClick={last ? finish : () => go(at + 1)}>
              {last ? t("wizardV2.hub.finish") : t("wizardV2.hub.next")}
            </Button>
            {(at > 0 || cardDirty) && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {at > 0 ? (
                  <Button type="button" variant="ghost" onClick={() => go(at - 1)} disabled={busy || photosOpen}>
                    {t("wizardV2.hub.back")}
                  </Button>
                ) : (
                  <span />
                )}
                {cardDirty && (
                  <button type="button" onClick={undo} disabled={busy} className="min-h-11 px-1 text-sm font-semibold text-muted underline">
                    {t("wizardV2.hub.undo")}
                  </button>
                )}
              </div>
            )}
            <Link href={`/client/contests/${props.slug}`} className="min-h-11 self-center py-2 text-sm font-semibold text-primary underline">
              {t("wizardV2.hub.later")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

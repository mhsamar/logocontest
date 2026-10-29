"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { useToast } from "@/components/ui/toast";
import { FieldInput } from "@/components/services/field-input";
import { BrandStep, BusinessStep, LinksStep, LookStep, NeedsStep, type BriefChoices, type BriefStepProps } from "@/components/wizard/steps-brief";
import { briefLinks, cleanBrief, STYLE_SLIDERS, validateBriefStepV2, type Brief, type FieldErrors } from "@/lib/contests/brief";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { v2AcceptBrief, v2SaveBriefSection } from "@/lib/onboarding/brief-actions";
import { BRIEF_SECTIONS, briefReadyPercent, SECTION_FIELDS, SECTION_STEPS, type BriefCompletion, type BriefSection } from "@/lib/onboarding/brief-defaults";
import { checkExtraAnswers, extraOn, type OnboardingConfig } from "@/lib/onboarding/config";
import type { Lang } from "@/lib/services/types";
import type { ServerFile } from "@/components/wizard/state";
import { HubPhotos, type PhotoActions } from "./hub-photos";

/** The server side; a local preview passes stand-ins so nothing is saved. */
export type HubActions = { save: typeof v2SaveBriefSection; accept: typeof v2AcceptBrief };
const SERVER: HubActions = { save: v2SaveBriefSection, accept: v2AcceptBrief };

/**
 * Onboarding v2's brief after paying (owner, 2026-10-29; spec §3): four cards already filled in from the business
 * type, each opening the old wizard's own editor in place (no pop-up), a "% ready" bar, "Looks right, finish" and the
 * optional Pro invitations. Each card is saved on its own; a changed card is the client's, the rest stay defaults.
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
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const actions = useMemo(() => ({ ...SERVER, ...props.actions }), [props.actions]);
  const hidden = useMemo(() => new Set(props.onboarding.hidden), [props.onboarding]);
  const [brief, setBrief] = useState(props.brief);
  const [edited, setEdited] = useState<BriefSection[]>(props.completion.edited);
  const [open, setOpen] = useState<BriefSection | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [draft, setDraft] = useState<Brief>(props.brief);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [extraErrors, setExtraErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const lang = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en || x.bn);
  const digit = (n: number) => (locale === "bn" ? String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : String(n));

  // The "none yet" ticks aren't stored: empty links or competitors are shown as ticked (as the defaults set them).
  const withTicks = (b: Brief): Brief => ({ ...b, noLinks: briefLinks(b).length === 0, noCompetitors: !b.competitors.trim() });
  const close = () => {
    setOpen(null);
    setServerErrors({});
    setExtraErrors({});
    setError(null);
  };
  const edit = (s: BriefSection) => {
    setDraft(withTicks(brief));
    setOpen(s);
    setTouched(new Set());
    setServerErrors({});
    setExtraErrors({});
    setError(null);
  };
  // What is wrong now (shown under the fields), plus the server's answer to the last save until those fields change.
  const checkNow = (s: BriefSection): FieldErrors => Object.assign({}, ...SECTION_STEPS[s].map((step) => validateBriefStepV2(step, draft)));
  const errorsFor = (s: BriefSection): FieldErrors => ({ ...serverErrors, ...checkNow(s) });

  const save = (s: BriefSection) => {
    const errors = checkNow(s);
    const asked = props.onboarding.extra.filter((q) => SECTION_STEPS[s].includes(q.step));
    const extraCheck = asked.length ? checkExtraAnswers(props.onboarding, draft.extra, SECTION_STEPS[s]).errors : {};
    if (Object.keys(errors).length || Object.keys(extraCheck).length) {
      // Show every problem on this card at once.
      setTouched(new Set([...Object.keys(errors), ...Object.keys(extraCheck).map((k) => `extra.${k}`)]));
      setExtraErrors(extraCheck);
      return;
    }
    setError(null);
    start(async () => {
      const part = Object.fromEntries(SECTION_FIELDS[s].map((f) => [f, draft[f]])) as Partial<Brief>;
      const res = await actions.save({ contestId: props.contestId, section: s, brief: s === "links" ? { ...part, noLinks: draft.noLinks, noCompetitors: draft.noCompetitors } : part, extra: draft.extra });
      if (!res.ok) {
        setServerErrors(res.errors ?? {});
        setExtraErrors(res.extraErrors ?? {});
        if (res.errors || res.extraErrors) setTouched(new Set([...Object.keys(res.errors ?? {}), ...Object.keys(res.extraErrors ?? {}).map((k) => `extra.${k}`)]));
        return setError(t(res.error));
      }
      // What the server kept (empty rows dropped, "none yet" honoured), so the card's summary matches it.
      setBrief(cleanBrief(draft));
      setEdited(res.edited);
      close();
      toast(t("wizardV2.hub.saved"), "success");
    });
  };

  const finish = () =>
    start(async () => {
      const res = await actions.accept({ contestId: props.contestId });
      if (!res.ok) return setError(t(res.error));
      router.push(`/client/contests/${props.slug}`);
    });

  // The cards' summaries, in words.
  const feel = (b: Brief) =>
    STYLE_SLIDERS.map((k) => {
      const v = b.sliders[k];
      const left = t(`wizard.sliders.${k}.left`);
      const right = t(`wizard.sliders.${k}.right`);
      if (v <= 1) return t("wizardV2.hub.feelOne", { a: left });
      if (v === 2) return t("wizardV2.hub.feelToward", { a: left });
      if (v === 3) return t("wizardV2.hub.feelMiddle", { a: left, b: right });
      if (v === 4) return t("wizardV2.hub.feelToward", { a: right });
      return t("wizardV2.hub.feelOne", { a: right });
    }).join(" · ");
  const hint = <span className="italic text-muted">{t("wizardV2.hub.emptyHint")}</span>;
  const line = (label: string, value: React.ReactNode) => (
    <p className="m-0 text-[14px] leading-snug text-ink">
      <span className="font-semibold">{label}:</span> {value}
    </p>
  );
  const chips = (items: string[]) => (
    <span className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span key={x} className="rounded-full bg-chip px-2.5 py-0.5 text-[12.5px] font-semibold text-ink">
          {x}
        </span>
      ))}
    </span>
  );
  const summary: Record<BriefSection, React.ReactNode> = {
    business: (
      <>
        {line(t("wizardV2.hub.slogan"), brief.slogan.trim() || hint)}
        {line(t("wizardV2.hub.description"), brief.businessDescription.trim() || hint)}
        {line(t("wizardV2.hub.audience"), brief.targetAudience.trim() || t("wizardV2.hub.none"))}
      </>
    ),
    links: (
      <>
        <p className="m-0 text-[14px] text-ink">{briefLinks(brief).length ? t("wizardV2.hub.links", { n: digit(briefLinks(brief).length) }) : `${t("wizard.links.linksTitle")}: ${t("wizardV2.hub.none")}`}</p>
        <p className="m-0 text-[14px] text-ink">{brief.competitors.trim() ? t("wizardV2.hub.competitors", { list: brief.competitors.trim() }) : t("wizardV2.hub.competitors", { list: t("wizardV2.hub.none") })}</p>
      </>
    ),
    look: (
      <>
        {brief.styles.length > 0 && chips(brief.styles.map((s) => t(`wizard.styles.${s}`)))}
        <p className="m-0 text-[14px] text-ink">{feel(brief)}</p>
        <p className="m-0 flex flex-wrap items-center gap-1.5 text-[14px] text-ink">
          {brief.letDesignersChoose || brief.colors.length === 0
            ? t("wizardV2.hub.designersChoose")
            : brief.colors.map((c) => <span key={c} className="inline-block size-5 rounded-full ring-1 ring-line" style={{ background: c }} title={c} />)}
        </p>
      </>
    ),
    needs: (
      <>
        {brief.usedOn.length > 0 && chips(brief.usedOn.map((u) => t(`wizard.usedOn.${u}`)))}
        {brief.deliverables.length > 0 && <p className="m-0 text-[14px] text-ink">{t("wizardV2.hub.extras", { list: brief.deliverables.map((d) => t(`wizard.deliverables.${d}.title`)).join(", ") })}</p>}
        <p className="m-0 text-[14px] text-ink">{t("wizardV2.hub.requirements", { n: digit(brief.requirements.length) })}</p>
      </>
    ),
  };

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
      <div className="mt-4 space-y-6 border-t border-line pt-4">
        {s === "business" && (
          <>
            <BrandStep {...p} />
            <BusinessStep {...p} />
          </>
        )}
        {s === "links" && <LinksStep {...p} />}
        {s === "look" && <LookStep {...p} />}
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" size="lg" className="sm:flex-1" loading={busy} onClick={() => save(s)}>
            {t("wizardV2.hub.save")}
          </Button>
          <Button type="button" variant="ghost" onClick={close}>
            {t("wizardV2.hub.cancel")}
          </Button>
        </div>
      </div>
    );
  };

  const percent = briefReadyPercent(brief);
  const typeLabel = brief.businessType ? t(`wizard.businessTypes.${brief.businessType}`) : "";

  return (
    <div className="flex w-full flex-1 flex-col px-3.5 pb-3.5 max-[720px]:px-2 max-[720px]:pb-2">
      <div className="flex-1 rounded-[32px] bg-frame px-6 py-8 sm:px-10 sm:py-10 max-[720px]:rounded-[24px] max-[720px]:bg-surface max-[720px]:px-4 max-[720px]:py-5">
        <div className="mx-auto w-full max-w-[560px] min-[721px]:rounded-2xl min-[721px]:border min-[721px]:border-line min-[721px]:bg-surface min-[721px]:p-8 min-[721px]:shadow-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-chip px-3 py-1 text-[13px] font-bold text-muted">{t("wizardV2.optional")}</span>
            {props.paid && <span className="rounded-full bg-success/10 px-3 py-1 text-[13px] font-bold text-success">{props.live ? t("wizardV2.hub.live") : t("wizardV2.done.badge")}</span>}
          </div>
          <h1 className="m-0 text-[clamp(26px,3.2vw,34px)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">{t("wizardV2.hub.title")}</h1>
          <p className="mb-6 mt-2 text-[16px] leading-relaxed text-muted">{t("wizardV2.hub.body", { type: typeLabel })}</p>

          <div className="flex flex-col gap-3">
            {BRIEF_SECTIONS.map((s, i) => {
              const mine = edited.includes(s);
              return (
                <section key={s} className={cx("rounded-2xl bg-surface p-4 ring-1", open === s ? "shadow-card ring-primary/40" : "ring-line")} data-section={s}>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="m-0 flex flex-wrap items-center gap-2 text-[16px] font-semibold text-ink">
                      {digit(i + 1)} · {t(`wizardV2.hub.cards.${s}`)}
                      <span className={cx("rounded-full px-2 py-0.5 text-[11.5px] font-bold", mine ? "bg-success/10 text-success" : "bg-chip text-muted")}>{mine ? t("wizardV2.hub.yoursTag") : t("wizardV2.hub.defaultTag")}</span>
                    </h2>
                    {open !== s && (
                      <button type="button" onClick={() => edit(s)} className="min-h-11 shrink-0 px-1 text-sm font-bold text-primary underline">
                        {t("wizardV2.hub.change")}
                      </button>
                    )}
                  </div>
                  {open === s ? editor(s) : <div className="mt-2 flex flex-col gap-1.5">{summary[s]}</div>}
                </section>
              );
            })}
            {props.photos && <HubPhotos contestId={props.contestId} number={digit(5)} files={props.photos.files} limits={props.photos.limits} onOpen={setPhotosOpen} actions={props.photoActions} />}
            {props.invites && (
              <section className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
                <div>
                  <h2 className="m-0 text-[16px] font-semibold text-ink">
                    {digit(props.photos ? 6 : 5)} · {t("wizardV2.hub.cards.invite")}
                  </h2>
                  <p className="m-0 mt-1 text-[14px] text-muted">{t("wizardV2.hub.inviteLine")}</p>
                </div>
                <ButtonLink href={`/start/invite?draft=${props.contestId}&from=hub`} variant="secondary" className="shrink-0 whitespace-nowrap">
                  {t("wizardV2.hub.invite")}
                </ButtonLink>
              </section>
            )}
          </div>

          <div className="mt-6">
            <p className="m-0 text-[13px] font-bold text-muted">{t("wizardV2.hub.ready", { n: digit(percent) })}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${percent}%` }} />
            </div>
          </div>

          {error && (
            <div className="mt-5">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          <div className="mt-6 flex flex-col items-center gap-2">
            {/* Not while a card is open: what is in it isn't saved yet. */}
            <Button type="button" size="lg" block loading={busy && open === null} disabled={open !== null || photosOpen} onClick={finish}>
              {t("wizardV2.hub.finish")}
            </Button>
            <Link href={`/client/contests/${props.slug}`} className="min-h-11 py-2 text-sm font-semibold text-primary underline">
              {t("wizardV2.hub.later")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

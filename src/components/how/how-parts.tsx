import Link from "next/link";
import { ACCENT_TEXT, Icon } from "@/components/home/sections";
import { Arrow } from "@/components/ui/section-heading";
import { MockCard, Stars } from "@/components/home/how-it-works";
import { SAMPLE_LOGOS } from "@/components/home/sample-logos";
import { Typewriter } from "@/components/home/typewriter";
import { cx } from "@/lib/cx";
import type { Translate } from "@/lib/i18n/translate";

/** Pieces of the How It Works page (UI-JOURNEY P-08). */

export function AccentTitle({ lead, accent, as: Tag = "h2", className, onView = true }: { lead: string; accent: string; as?: "h1" | "h2"; className?: string; onView?: boolean }) {
  return (
    <Tag className={cx("font-bold leading-tight tracking-tight text-ink", className)}>
      {lead} <span className="sr-only">{accent}</span>
      <span className="font-display text-[1.15em] font-normal italic tracking-normal">
        <Typewriter phrases={[accent]} onView={onView} delay={onView ? 200 : 450} className={ACCENT_TEXT} />
      </span>
    </Tag>
  );
}

export type StepFaq = { q: string; a: string };

const TICK = "M5 12.5l4.5 4.5L19 7.5";
const PLUS = "M12 5v14M5 12h14";

/** One step in its own panel (site design, owner 2026-10-10): the mock on one side; the step chip, title, ticks and questions on the other. */
export function Step({
  n,
  stepLabel,
  lead,
  accent,
  body,
  points,
  faqs,
  mock,
  flip,
  tone = "white",
  moreHref,
  moreLabel,
}: {
  n: number;
  stepLabel: string;
  lead: string;
  accent: string;
  body: string;
  points: string[];
  faqs: StepFaq[];
  mock: React.ReactNode;
  flip?: boolean;
  tone?: "white" | "grey";
  moreHref: string;
  moreLabel: string;
}) {
  return (
    <section id={`step-${n}`} className={cx("scroll-mt-32 rounded-[32px] px-6 py-12 sm:px-10 sm:py-16 max-[720px]:rounded-[24px] max-[720px]:px-4", tone === "white" ? "bg-surface" : "bg-frame")}>
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={cx("lc-rv-soft flex justify-center", flip && "lg:order-2")}>
          <div className={cx("flex w-full max-w-md justify-center rounded-[28px] px-5 py-10 sm:px-8", tone === "white" ? "bg-frame" : "bg-surface")}>{mock}</div>
        </div>
        <div className="lc-rv">
          <span className="inline-flex items-center gap-2 rounded-full bg-tint px-3.5 py-1.5 text-sm font-bold text-primary">{stepLabel}</span>
          <h2 className="mt-4 text-[clamp(28px,3.4vw,42px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">
            {lead} <span className="text-primary">{accent}</span>
          </h2>
          <p className="mt-4 leading-relaxed text-muted">{body}</p>
          <ul className="mt-5 space-y-2.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 font-medium text-ink">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-tint text-primary">
                  <Icon d={TICK} className="size-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          {faqs.length > 0 && (
            <div className="mt-6 flex flex-col gap-2">
              {faqs.map((f) => (
                <details key={f.q} name={`step-${n}-faq`} className="lc-card group rounded-[18px] px-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-2 text-[0.9375rem] font-bold text-ink">
                    {f.q}
                    <Icon d={PLUS} className="size-4 shrink-0 text-primary transition-transform duration-200 group-open:rotate-45" />
                  </summary>
                  <p className="m-0 pb-4 pr-6 text-sm leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          )}
          <Link href={moreHref} className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary hover:underline">
            {moreLabel} <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Designer step 1: a public profile card with a QR code. */
export function ProfileMock({ t, qrSvg }: { t: Translate; qrSvg: string }) {
  return (
    <MockCard t={t}>
      <div className="flex items-center gap-3">
        <span className="flex size-14 items-center justify-center lc-d rounded-full bg-tint text-2xl font-semibold text-primary" aria-hidden>
          R
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">Rafi Ahmed</p>
          <p className="font-mono text-xs text-muted">@rafi_designs</p>
        </div>
        <div className="size-16 rounded-lg bg-white p-1 ring-1 ring-line [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {SAMPLE_LOGOS.slice(0, 3).map((logo, i) => (
          <div key={i} className="aspect-square overflow-hidden rounded-lg ring-1 ring-line">
            <div className="flex h-full items-center">{logo}</div>
          </div>
        ))}
      </div>
    </MockCard>
  );
}

/** Designer step 3: the wallet after a win (prize minus the first fee tier, from settings). */
export function WalletMock({ t, prize, net, fee }: { t: Translate; prize: string; net: string; fee: number }) {
  return (
    <MockCard t={t}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("designerDash.stats.earned")}</p>
      <p className="mt-1 lc-d text-3xl font-semibold tracking-[-0.03em] text-primary tabular-nums">{net}</p>
      <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-frame p-3">
        <div className="size-10 overflow-hidden rounded-md ring-1 ring-line">
          <div className="flex h-full items-center">{SAMPLE_LOGOS[0]}</div>
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold text-ink">{t("home.preview.brand")}</p>
          <p className="text-muted">
            {prize} − {fee}%
          </p>
        </div>
        <span className="text-sm font-bold text-success tabular-nums">+{net}</span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Stars value={5} />
        <span className="rounded-full bg-[image:var(--gradient-red)] px-3 py-1 text-xs font-bold text-white">{t("designerSignup.payout.bkash")}</span>
      </div>
    </MockCard>
  );
}

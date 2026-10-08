import Link from "next/link";
import { ACCENT_TEXT, Icon } from "@/components/home/sections";
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

/** One step: a huge faint number behind, a mock on one side, the text, ticks and questions on the other. */
export function Step({
  n,
  lead,
  accent,
  body,
  points,
  faqs,
  mock,
  flip,
  moreHref,
  moreLabel,
}: {
  n: number;
  lead: string;
  accent: string;
  body: string;
  points: string[];
  faqs: StepFaq[];
  mock: React.ReactNode;
  flip?: boolean;
  moreHref: string;
  moreLabel: string;
}) {
  return (
    <section id={`step-${n}`} className="relative scroll-mt-28 py-14 sm:py-20">
      <span
        className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 select-none font-display text-[11rem] leading-none text-primary/[0.06] sm:text-[16rem]"
        aria-hidden
      >
        {n}
      </span>
      <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 lg:grid-cols-2 lg:gap-16">
        <div className={cx("flex justify-center", flip && "lg:order-2")}>
          <div className="w-full max-w-sm animate-float-soft">{mock}</div>
        </div>
        <div>
          <AccentTitle lead={lead} accent={accent} className="text-h2 lg:text-h2-lg" />
          <span className="mt-4 block h-1 w-12 rounded-full bg-gradient-to-r from-primary to-accent" aria-hidden />
          <p className="mt-4 leading-relaxed text-muted">{body}</p>
          <ul className="mt-5 space-y-2.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-ink">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                  <Icon d="M5 12.5l4.5 4.5L19 7.5" className="size-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[0.9375rem] font-medium text-ink">
                  {f.q}
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-primary ring-1 ring-line transition-transform group-open:rotate-45">
                    <Icon d="M12 5v14M5 12h14" className="size-3.5" />
                  </span>
                </summary>
                <p className="pb-4 pr-8 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <Link href={moreHref} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
            {moreLabel} →
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
        <span className="flex size-14 items-center justify-center rounded-full bg-cream font-display text-2xl italic text-primary-dark" aria-hidden>
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
      <p className="mt-1 text-3xl font-bold text-accent tabular-nums">{net}</p>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-canvas p-3">
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
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">{t("designerSignup.payout.bkash")}</span>
      </div>
    </MockCard>
  );
}

import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { SAMPLE_LOGOS } from "./sample-logos";

/** Home page section 4 (UI-JOURNEY P-01): the five benefits as a bento grid, each with a small picture. */

function Card({ title, body, children, dark, className }: { title: string; body: string; children: React.ReactNode; dark?: boolean; className?: string }) {
  return (
    <li
      className={cx(
        "relative flex flex-col overflow-hidden rounded-2xl p-6 ring-1 sm:p-7",
        dark ? "bg-aurora text-ink shadow-card ring-white" : "bg-surface shadow-card ring-line",
        className,
      )}
    >
      <div className="flex-1" aria-hidden>
        {children}
      </div>
      <h3 className={cx("mt-6 font-bold leading-snug", dark ? "text-2xl text-ink lg:text-[1.75rem]" : "text-lg text-ink")}>{title}</h3>
      <p className={cx("mt-1.5 leading-relaxed", dark ? "text-muted lg:text-lg" : "text-muted")}>{body}</p>
    </li>
  );
}

function Tick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-3.5", className)} fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-3.5", className)} fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

/** Many ideas: a wall of our sample logos. */
function IdeasArt({ t }: { t: Translate }) {
  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-2.5">
        {SAMPLE_LOGOS.map((logo, i) => (
          <div
            key={i}
            className={cx("aspect-square overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-line", i % 2 === 1 && "translate-y-3")}
          >
            <div className="flex h-full items-center">{logo}</div>
          </div>
        ))}
      </div>
      <span className="absolute -bottom-1 right-0 rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink shadow-card">+ {t("home.why.art.more")}</span>
    </div>
  );
}

/** Pay in taka: a taka coin with bKash and card chips. */
function TakaArt({ t }: { t: Translate }) {
  return (
    <div className="flex items-center gap-4">
      <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cream to-accent/40 text-3xl font-bold text-primary-dark ring-4 ring-cream/60">৳</span>
      <div className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">{t("home.why.art.bkash")}</span>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-bold text-cream">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M3 10h18" />
          </svg>
          {t("home.why.art.card")}
        </span>
      </div>
    </div>
  );
}

/** Original: human-made yes, AI-made no. */
function OriginalArt({ t }: { t: Translate }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success ring-1 ring-success/20">
        <span className="flex size-5 items-center justify-center rounded-full bg-success text-white">
          <Tick className="size-3" />
        </span>
        {t("home.why.art.human")}
      </span>
      <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-danger/5 px-3 py-2 text-sm font-semibold text-danger/80 line-through decoration-2 ring-1 ring-danger/15">
        <span className="flex size-5 items-center justify-center rounded-full bg-danger/80 text-white">
          <Cross className="size-3" />
        </span>
        {t("home.why.art.ai")}
      </span>
    </div>
  );
}

/** Ownership: a little copyright certificate with the files. */
function OwnershipArt({ t }: { t: Translate }) {
  return (
    <div className="relative w-full max-w-[15rem] rounded-xl bg-cream/50 p-3.5 ring-1 ring-cream">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary-dark">© {t("home.why.art.copyright")}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-bold text-white">
          <Tick className="size-3" />
          {t("home.why.art.yours")}
        </span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {["AI", "SVG", "PNG", "PDF"].map((f) => (
          <span key={f} className="rounded bg-ink px-1.5 py-1 text-[0.625rem] font-bold text-cream">
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Money is safe: you pay → we hold → designer paid. */
function HeldArt({ t }: { t: Translate }) {
  const steps = [
    { label: t("home.why.art.pay"), tone: "bg-ink text-cream" },
    { label: t("home.why.art.hold"), tone: "bg-primary text-white ring-4 ring-primary/15" },
    { label: t("home.why.art.release"), tone: "bg-success text-white" },
  ];
  return (
    <div>
      <ol className="flex items-center">
        {steps.map((s, i) => (
          <li key={s.label} className={cx("flex items-center", i < steps.length - 1 && "flex-1")}>
            <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", s.tone)}>
              {i === 1 ? (
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" strokeLinejoin="round" />
                </svg>
              ) : i === 2 ? (
                <Tick className="size-4" />
              ) : (
                <span className="text-sm font-bold">৳</span>
              )}
            </span>
            {i < steps.length - 1 && <span className="mx-1.5 h-0.5 flex-1 rounded-full bg-gradient-to-r from-line to-primary/40" />}
          </li>
        ))}
      </ol>
      <div className="mt-2 grid grid-cols-3 text-[0.6875rem] font-semibold text-muted">
        <span>{steps[0].label}</span>
        <span className="text-center text-primary">{steps[1].label}</span>
        <span className="text-right">{steps[2].label}</span>
      </div>
      <p className="mt-2 text-center text-[0.6875rem] text-muted">{t("home.why.art.afterApprove")}</p>
    </div>
  );
}

export async function WhyBento() {
  const { t } = await getI18n();
  const text = (key: "ideas" | "bkash" | "original" | "ownership" | "held") => ({
    title: t(`home.why.${key}.title`),
    body: t(`home.why.${key}.body`),
  });
  return (
    <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
      <Card {...text("ideas")} dark className="sm:col-span-2 lg:col-span-1 lg:row-span-2">
        <IdeasArt t={t} />
      </Card>
      <Card {...text("bkash")}>
        <TakaArt t={t} />
      </Card>
      <Card {...text("original")}>
        <OriginalArt t={t} />
      </Card>
      <Card {...text("ownership")}>
        <OwnershipArt t={t} />
      </Card>
      <Card {...text("held")}>
        <HeldArt t={t} />
      </Card>
    </ul>
  );
}

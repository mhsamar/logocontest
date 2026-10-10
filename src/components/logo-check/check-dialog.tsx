"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import type { CheckView } from "@/lib/logo-check/queries";
import { certNumber } from "@/lib/logo-check/rules";
import type { CheckerSetup } from "./checker-context";
import { ScoreRing, ShieldIcon, SourceList, VerdictBanner } from "./parts";

const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const UPLOAD_MAX = 4 * 1024 * 1024;

type Choice = { kind: "entry"; id: string; number: number; coverUrl: string | null } | { kind: "upload"; file: File; preview: string };

/**
 * The AI copyright checker pop-up (owner, 2026-10-10; Design/copyright-checker/client-check-popup.html):
 * 1 choose, 2 check (live progress), 3 result, 4 certificate. Full screen on phones.
 */
export function CheckDialog({ setup, lens, initial, onClose }: { setup: CheckerSetup | null; lens: boolean; initial: { entryId?: string | null; checkId?: string; step?: 3 | 4 }; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [checkId, setCheckId] = useState<string | null>(initial.checkId ?? null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initial.checkId ? (initial.step ?? 2) : 1);
  const [check, setCheck] = useState<CheckView | null>(null);
  const refreshed = useRef(false);

  // Escape closes; the page behind doesn't scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  // Ask for the check's status every 2 seconds until it is finished.
  useEffect(() => {
    if (!checkId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`/api/logo-checks/${checkId}`, { cache: "no-store" });
        const json = (await res.json()) as { ok: boolean; check?: CheckView };
        if (stop) return;
        if (json.ok && json.check) {
          setCheck(json.check);
          if (json.check.status === "done" || json.check.status === "failed") {
            if (json.check.status === "done") setStep((s) => (s === 2 ? 3 : s));
            if (!refreshed.current) {
              refreshed.current = true;
              router.refresh();
            }
            return;
          }
        }
      } catch {
        // Network blip: try again on the next tick.
      }
      if (!stop) timer = setTimeout(poll, 2000);
    };
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [checkId, router]);

  const started = (id: string) => {
    refreshed.current = false;
    setCheck(null);
    setCheckId(id);
    setStep(2);
    router.refresh();
  };
  const again = () => {
    setCheck(null);
    setCheckId(null);
    setStep(1);
  };

  const state = setup?.state;
  const brand = check?.contest.brand ?? setup?.contest.brand ?? "";
  const used = state ? state.used : null;
  const STEPS = ["choose", "check", "result", "certificate"] as const;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-stretch justify-center bg-ink/55 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("checker.title")}
        className="flex h-dvh w-full flex-col overflow-hidden bg-surface shadow-[0_24px_60px_rgb(17_18_22/0.28)] sm:h-auto sm:max-h-[92dvh] sm:max-w-[860px] sm:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-6 sm:py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-tint text-primary">
            <ShieldIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[17px] font-semibold text-ink">{t("checker.title")}</p>
            <p className="m-0 truncate text-[13.5px] text-muted">
              {brand}
              {state && used !== null ? ` · ${t("checker.usedOf", { used: String(used), limit: String(state.limits.perContest) })}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("checker.close")} className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-chip text-ink hover:text-primary">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <ol className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-6">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = n < step;
            const on = n === step;
            return (
              <li key={s} className={cx("flex items-center gap-2 text-sm font-semibold", on ? "text-ink" : done ? "text-ink" : "text-muted")} aria-current={on ? "step" : undefined}>
                <span className={cx("flex size-6 items-center justify-center rounded-full text-xs font-bold", done ? "bg-success text-white" : on ? "bg-primary text-white" : "bg-chip text-muted")}>
                  {done ? (
                    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    n
                  )}
                </span>
                {t(`checker.steps.${s}`)}
              </li>
            );
          })}
        </ol>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto [&>*]:flex-1">
          {step === 1 && setup ? (
            <ChooseStep setup={setup} lens={lens} initialEntryId={initial.entryId ?? null} onStarted={started} />
          ) : step === 2 || !check ? (
            <RunStep check={check} lens={lens} onClose={onClose} onRetry={setup ? again : null} />
          ) : step === 3 ? (
            <ResultStep check={check} canCheckAnother={!!setup && setup.state.checkable && check.left > 0} onAnother={again} onCertificate={() => setStep(4)} />
          ) : (
            <CertificateStep check={check} onClose={onClose} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---- Step 1: choose ------------------------------------------------------------------------------

function ChooseStep({ setup, lens, initialEntryId, onStarted }: { setup: CheckerSetup; lens: boolean; initialEntryId: string | null; onStarted: (id: string) => void }) {
  const { t } = useI18n();
  const taken = new Map(setup.state.checks.filter((c) => c.status !== "failed" && c.entryId).map((c) => [c.entryId!, c]));
  const first = setup.designs.find((d) => d.id === initialEntryId && !taken.has(d.id)) ?? setup.designs.find((d) => !taken.has(d.id)) ?? null;
  const [pick, setPick] = useState<Choice | null>(first ? { kind: "entry", id: first.id, number: first.number, coverUrl: first.coverUrl } : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string>(crypto.randomUUID());
  const fileInput = useRef<HTMLInputElement>(null);
  const left = setup.state.left;

  useEffect(() => () => (pick?.kind === "upload" ? URL.revokeObjectURL(pick.preview) : undefined), [pick]);

  const choose = (p: Choice) => {
    key.current = crypto.randomUUID();
    setError(null);
    setPick(p);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!UPLOAD_TYPES.includes(file.type)) return setError(t("checker.errors.bad_file"));
    if (file.size > UPLOAD_MAX) return setError(t("checker.errors.too_big"));
    choose({ kind: "upload", file, preview: URL.createObjectURL(file) });
  };

  const start = async () => {
    if (!pick || busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("contestId", setup.contest.id);
    form.set("requestKey", key.current);
    if (pick.kind === "entry") form.set("entryId", pick.id);
    else form.set("file", pick.file);
    try {
      const res = await fetch("/api/logo-checks", { method: "POST", body: form });
      const json = (await res.json()) as { ok: boolean; id?: string; error?: string };
      if (json.ok && json.id) return onStarted(json.id);
      setError(t(`checker.errors.${json.error ?? "invalid"}` as MessageKey));
    } catch {
      setError(t("checker.errors.network"));
    }
    setBusy(false);
  };

  const blocked = !setup.ready ? t("checker.errors.not_set_up") : !setup.state.checkable ? t("checker.errors.closed") : setup.state.access === "locked" ? t("checker.errors.locked") : left <= 0 ? t("checker.errors.limit") : null;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div>
          <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-ink">{t("checker.choose.title")}</h2>
          <p className="m-0 mt-1 text-[15px] text-muted">{t("checker.choose.lead")}</p>
        </div>

        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
          {setup.designs.map((d) => {
            const done = taken.get(d.id);
            const on = pick?.kind === "entry" && pick.id === d.id;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  disabled={!!done}
                  onClick={() => choose({ kind: "entry", id: d.id, number: d.number, coverUrl: d.coverUrl })}
                  aria-pressed={on}
                  className={cx("relative flex w-full flex-col items-center gap-2 rounded-[16px] p-3 text-center ring-1 transition-colors disabled:cursor-not-allowed", on ? "bg-tint/50 ring-2 ring-primary" : done ? "bg-surface ring-line" : "bg-surface ring-line hover:ring-primary")}
                >
                  {on && (
                    <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-white" aria-hidden>
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  )}
                  <span className={cx("flex aspect-square w-full max-w-[120px] items-center justify-center overflow-hidden rounded-[12px] bg-white ring-1 ring-line", done && "opacity-50")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {d.coverUrl ? <img src={d.coverUrl} alt="" className="size-full object-contain" /> : <span className="text-sm text-muted">#{d.number}</span>}
                  </span>
                  <span className={cx("text-[15px] font-semibold", done ? "text-muted" : "text-ink")}>{t("checker.choose.design", { n: String(d.number) })}</span>
                  <span className={cx("text-[13px]", done ? "text-success" : on ? "text-primary" : "text-muted")}>{done ? t("checker.choose.checked") : on ? t("checker.choose.chosen") : t("checker.choose.notChecked")}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-pressed={pick?.kind === "upload"}
              className={cx("flex h-full min-h-[170px] w-full flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed p-3 text-center transition-colors", pick?.kind === "upload" ? "border-primary bg-tint/50" : "border-line hover:border-primary")}
            >
              {pick?.kind === "upload" ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pick.preview} alt="" className="aspect-square w-full max-w-[110px] rounded-[12px] bg-white object-contain ring-1 ring-line" />
                  <span className="text-[15px] font-semibold text-ink">{t("checker.choose.uploaded")}</span>
                  <span className="text-[13px] text-primary">{t("checker.choose.change")}</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="size-6 text-ink" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 20h14" />
                  </svg>
                  <span className="text-[15px] font-semibold text-ink">{t("checker.choose.upload")}</span>
                  <span className="text-[13px] text-muted">{t("checker.choose.uploadTypes")}</span>
                </>
              )}
            </button>
            <input ref={fileInput} type="file" accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </li>
        </ul>

        <div className="rounded-[16px] bg-frame p-4">
          <p className="m-0 text-[15px] font-semibold text-ink">{t("checker.choose.getTitle")}</p>
          <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0 text-[14.5px] leading-snug text-ink">
            {(
              [
                ["get1b", "get1"],
                ["get2b", "get2"],
                ["get3b", "get3"],
              ] as const
            ).map(([b, rest]) => (
              <li key={b} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success" aria-hidden>
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span>
                  <strong>{t(`checker.choose.${b}`)}</strong> {t(`checker.choose.${rest}`, { search: t(lens ? "checker.search.lens" : "checker.search.google") })}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {error && <p className="m-0 rounded-[12px] bg-danger/10 px-3.5 py-2.5 text-[14.5px] text-danger">{error}</p>}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-frame/95 px-4 py-3.5 backdrop-blur sm:px-6">
        <p className="m-0 min-w-0 flex-1 text-[14px] text-muted">{blocked ?? t("checker.choose.uses", { n: String(left) })}</p>
        <button type="button" onClick={start} disabled={!pick || busy || !!blocked} className="inline-flex min-h-12 items-center gap-2 rounded-[12px] bg-primary px-5 text-[15.5px] font-bold text-white hover:bg-primary-dark disabled:opacity-50 max-sm:w-full max-sm:justify-center">
          <ShieldIcon className="size-4" />
          {busy ? t("checker.choose.starting") : t("checker.choose.start")}
        </button>
      </div>
    </div>
  );
}

// ---- Step 2: the check runs ----------------------------------------------------------------------

function RunStep({ check, lens, onClose, onRetry }: { check: CheckView | null; lens: boolean; onClose: () => void; onRetry: (() => void) | null }) {
  const { t } = useI18n();
  if (check?.status === "failed") {
    const code = (["not_logo", "search_unavailable", "ai_unavailable"] as const).find((c) => c === check.error) ?? "technical";
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center sm:p-10">
        <span className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 8v5M12 16.5v.5" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
        <h2 className="m-0 text-[22px] font-semibold text-ink">{t("checker.failed.title")}</h2>
        <p className="m-0 max-w-md text-[15px] text-muted">
          {t(`checker.failed.${code}`)} {t("checker.failed.notCounted")}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex min-h-12 items-center rounded-[12px] bg-primary px-5 text-[15.5px] font-bold text-white hover:bg-primary-dark">
              {t("checker.failed.retry")}
            </button>
          )}
          <button type="button" onClick={onClose} className="inline-flex min-h-12 items-center rounded-[12px] border border-line px-5 text-[15.5px] font-bold text-ink hover:border-primary">
            {t("checker.close")}
          </button>
        </div>
      </div>
    );
  }

  // Server steps 1-5 match the five rows; 6 (saving) shows everything done.
  const step = check?.step ?? 0;
  const rows = [
    { key: "read", title: t("checker.run.read"), line: t("checker.run.readLine") },
    { key: "web", title: t(lens ? "checker.search.lensTitle" : "checker.search.googleTitle"), line: t("checker.run.webLine") },
    { key: "site", title: t("checker.run.site"), line: t("checker.run.siteLine") },
    { key: "shape", title: t("checker.run.shape"), line: t("checker.run.shapeLine") },
    { key: "font", title: t("checker.run.font"), line: t("checker.run.fontLine") },
  ];
  const r = check?.reading;
  const tags = r ? [r.shape, t(`checker.types.${r.logo_type}` as MessageKey), r.text ? t("checker.run.textTag", { text: r.text }) : null, r.colors.length ? t("checker.run.colours", { n: String(r.colors.length) }) : null].filter((x): x is string => !!x) : [];
  const name = check?.entry ? t("checker.choose.design", { n: String(check.entry.number) }) : t("checker.choose.uploaded");
  const current = Math.min(Math.max(step, 1), 5);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white ring-1 ring-line sm:size-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {check?.logoUrl ? <img src={check.logoUrl} alt="" className="size-full object-contain p-1.5" /> : <span className="size-6 animate-spin rounded-full border-2 border-line border-t-primary" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[20px] font-semibold text-ink">{t("checker.run.checking", { name })}</p>
            <p className="m-0 mt-0.5 text-[14px] text-muted">{t("checker.run.stepOf", { n: String(current), title: rows[current - 1].title })}</p>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-chip">
              <span className="block h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(6, Math.round((Math.min(step, 6) / 6) * 100))}%` }} />
            </div>
            {tags.length > 0 && (
              <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-1.5 p-0">
                {tags.map((x) => (
                  <li key={x} className="rounded-full bg-chip px-2.5 py-0.5 text-[13px] font-semibold text-ink">
                    {x}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <p className="m-0 text-[15px] font-semibold text-ink">{t("checker.run.doing")}</p>
          <ol className="m-0 mt-2 list-none divide-y divide-line p-0">
            {rows.map((row, i) => {
              const n = i + 1;
              const state = step > n ? "done" : step === n ? "searching" : "waiting";
              return (
                <li key={row.key} className="flex items-center gap-3 py-3">
                  <span className={cx("flex size-6 shrink-0 items-center justify-center rounded-full", state === "done" ? "bg-success/15 text-success" : state === "searching" ? "text-primary" : "text-muted")} aria-hidden>
                    {state === "done" ? (
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    ) : state === "searching" ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                    ) : (
                      <span className="size-2 rounded-full bg-line" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{row.title}</span>
                    <span className="block text-[13.5px] text-muted">{row.line}</span>
                  </span>
                  <span className={cx("shrink-0 text-[13.5px] font-semibold", state === "done" ? "text-ink" : state === "searching" ? "text-primary" : "text-muted")}>{t(`checker.run.${state}`)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-frame/95 px-4 py-3.5 backdrop-blur sm:px-6">
        <p className="m-0 min-w-0 flex-1 text-[14px] text-muted">
          {t("checker.run.canClose")}{" "}
          <Link href="/dashboard/logo-checks" className="font-semibold text-ink hover:text-primary">
            {t("checker.myChecks")}
          </Link>
          .
        </p>
        <button type="button" onClick={onClose} className="inline-flex min-h-12 items-center rounded-[12px] border border-line bg-surface px-5 text-[15px] font-bold text-ink hover:border-primary max-sm:w-full max-sm:justify-center">
          {t("checker.run.closeKeep")}
        </button>
      </div>
    </div>
  );
}

// ---- Step 3: the result --------------------------------------------------------------------------

function ResultStep({ check, canCheckAnother, onAnother, onCertificate }: { check: CheckView; canCheckAnother: boolean; onAnother: () => void; onCertificate: () => void }) {
  const { t } = useI18n();
  const r = check.reading;
  const top = check.matches[0] ?? null;
  const close = check.matches.filter((m) => m.isClose).length;
  const name = check.entry ? t("checker.choose.design", { n: String(check.entry.number) }) : t("checker.choose.uploaded");
  const s = check.sources;
  const searchedWith = [s?.lens.ran && t("checker.search.lens"), s?.vision.ran && t("checker.search.vision"), t("checker.search.site")].filter(Boolean).join(", ");
  const card = "rounded-[16px] bg-frame p-3.5";
  const label = "m-0 text-[13px] text-muted";

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <VerdictBanner verdict={check.verdict ?? "no_match"} close={close} closest={top?.similarity ?? 0} name={name} />

        {r && (
          <section>
            <h3 className="m-0 text-[17px] font-semibold text-ink">{t("checker.result.sees")}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr]">
              <span className="flex aspect-square items-center justify-center overflow-hidden rounded-[16px] bg-white ring-1 ring-line sm:aspect-auto sm:min-h-[200px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {check.logoUrl && <img src={check.logoUrl} alt="" className="size-full object-contain p-3" />}
              </span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className={card}>
                  <p className={label}>{t("checker.result.shape")}</p>
                  <p className="m-0 mt-1 text-[15px] font-semibold text-ink">{r.shape}</p>
                </div>
                <div className={card}>
                  <p className={label}>{t("checker.result.type")}</p>
                  <p className="m-0 mt-1 text-[15px] font-semibold text-ink">{t(`checker.types.${r.logo_type}` as MessageKey)}</p>
                </div>
                <div className={card}>
                  <p className={label}>{t("checker.result.letters")}</p>
                  <p className="m-0 mt-1 break-words text-[15px] font-semibold text-ink">{r.text || t("checker.result.noLetters")}</p>
                </div>
                <div className={cx(card, "col-span-2 sm:col-span-3")}>
                  <p className={label}>{t("checker.result.colours")}</p>
                  <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-2 p-0">
                    {r.colors.map((hex) => (
                      <li key={hex} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                        <span className="size-4 rounded-[5px] ring-1 ring-black/10" style={{ background: hex }} />
                        <span className="font-mono uppercase">{hex.replace("#", "")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-[18px] bg-ink p-4 text-white">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 text-[17px] font-semibold">{t("checker.result.similarTitle")}</h3>
            <span className="text-[13.5px] text-white/70">{t("checker.result.foundCount", { n: String(check.matches.length), close: String(close) })}</span>
          </div>
          {check.matches.length === 0 ? (
            <p className="m-0 mt-3 text-[15px] text-white/80">{t("checker.result.noSimilar")}</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <figure className="m-0 flex flex-col gap-1.5">
                <span className="flex aspect-square items-center justify-center overflow-hidden rounded-[14px] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {check.logoUrl && <img src={check.logoUrl} alt="" className="size-full object-contain p-4" />}
                </span>
                <figcaption className="text-[13.5px] font-semibold">{t("checker.result.yourLogo")}</figcaption>
              </figure>
              <ul className="m-0 grid list-none grid-cols-3 content-start gap-2 p-0">
                {check.matches.map((m) => (
                  <li key={m.position} className={cx("relative aspect-square overflow-hidden rounded-[12px] bg-white", m.isClose ? "ring-[3px] ring-[#d08a1e]" : "ring-1 ring-white/20")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.imageUrl && <img src={m.imageUrl} alt="" className="size-full object-contain p-1.5" />}
                    <span className={cx("absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[12px] font-bold", m.isClose ? "bg-[#ffedd5] text-[#9a3412]" : "bg-chip text-ink")}>{m.similarity}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="m-0 mt-3 text-[13px] text-white/70">{t("checker.result.similarNote", { sources: searchedWith })}</p>
        </section>

        {top && (
          <section>
            <h3 className="m-0 text-[17px] font-semibold text-ink">{t("checker.result.closestTitle")}</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr_1.3fr]">
              <figure className="m-0 flex flex-col gap-1.5">
                <span className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[14px] bg-white ring-1 ring-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {check.logoUrl && <img src={check.logoUrl} alt="" className="size-full object-contain p-3" />}
                </span>
                <figcaption className="text-[13.5px] text-muted">{t("checker.result.yourLogo")}</figcaption>
              </figure>
              <figure className="m-0 flex flex-col gap-1.5">
                <span className={cx("relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[14px] bg-white", top.isClose ? "ring-2 ring-[#d08a1e]" : "ring-1 ring-line")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {top.imageUrl && <img src={top.imageUrl} alt="" className="size-full object-contain p-3" />}
                  <span className="absolute bottom-2 left-2 rounded-full bg-[#ffedd5] px-2 py-0.5 text-[12px] font-bold text-[#9a3412]">{top.similarity}%</span>
                </span>
                <figcaption className="min-w-0 text-[13.5px] text-muted">
                  {t("checker.result.foundOn")}{" "}
                  {top.pageUrl ? (
                    <a href={top.pageUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-semibold text-primary hover:underline">
                      {top.foundBy === "site" ? t("checker.result.onSite") : (top.site ?? top.title ?? top.pageUrl)}
                    </a>
                  ) : (
                    <span className="font-semibold text-ink">{top.foundBy === "site" ? t("checker.result.onSite") : (top.site ?? t("checker.search.web"))}</span>
                  )}
                </figcaption>
              </figure>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[14.5px] text-ink">
                {top.same.map((x) => (
                  <li key={`s${x}`} className="flex items-start gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ffedd5] text-[12px] font-bold text-[#9a3412]">=</span>
                    {x}
                  </li>
                ))}
                {top.different.map((x) => (
                  <li key={`d${x}`} className="flex items-start gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-[12px] font-bold text-success">≠</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {r && (
          <section className="flex flex-col gap-3 rounded-[16px] p-4 ring-1 ring-line sm:flex-row sm:items-center">
            <span className="flex h-16 shrink-0 items-center justify-center rounded-[12px] bg-chip px-5 text-[22px] font-semibold text-ink sm:w-40">
              <span className="truncate">{r.text || "—"}</span>
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="m-0 text-[16px] font-semibold text-ink">{t("checker.result.fontTitle")}</h3>
              <p className="m-0 mt-1 text-[14.5px] text-muted">
                {!r.text ? t("checker.result.noText") : `${r.font_guess ? t("checker.result.fontLooks", { font: r.font_guess, look: r.font_look }) : t("checker.result.fontLooksNoName", { look: r.font_look })} ${t("checker.result.fontAsk")}`}
              </p>
            </div>
          </section>
        )}

        {check.scores && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["uniqueness", "legibility", "colour", "overall"] as const).map((k) => (
              <div key={k} className="flex flex-col items-center gap-1.5 rounded-[16px] p-3.5 text-center ring-1 ring-line">
                <ScoreRing value={check.scores![k].score} />
                <p className="m-0 text-[15px] font-semibold text-ink">{t(`checker.scores.${k}`)}</p>
                <p className="m-0 text-[13px] leading-snug text-muted">{check.scores![k].line}</p>
              </div>
            ))}
          </section>
        )}

        {s && (
          <section>
            <h3 className="m-0 text-[17px] font-semibold text-ink">{t("checker.result.howTitle")}</h3>
            <SourceList sources={s} />
          </section>
        )}

        {check.advice && (
          <section className="rounded-[16px] bg-frame p-4">
            <h3 className="m-0 text-[16px] font-semibold text-ink">{t("checker.result.meansTitle")}</h3>
            <p className="m-0 mt-1.5 text-[15px] leading-relaxed text-ink">{check.advice}</p>
            <p className="m-0 mt-2 text-[13px] text-muted">{t("checker.note")}</p>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 grid gap-2 border-t border-line bg-frame/95 px-4 py-3.5 backdrop-blur sm:flex sm:flex-wrap sm:px-6">
        {check.entry && (
          <Link href={`/dashboard/contests/${check.contest.slug}?entry=${check.entry.number}`} className="inline-flex min-h-12 items-center justify-center rounded-[12px] border border-line bg-surface px-4 text-[15px] font-bold text-ink hover:border-primary sm:flex-1">
            {t("checker.result.askDesigner")}
          </Link>
        )}
        {canCheckAnother && (
          <button type="button" onClick={onAnother} className="inline-flex min-h-12 items-center justify-center rounded-[12px] border border-line bg-surface px-4 text-[15px] font-bold text-ink hover:border-primary sm:flex-1">
            {t("checker.result.another", { n: String(check.left) })}
          </button>
        )}
        <button type="button" onClick={onCertificate} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-primary px-5 text-[15.5px] font-bold text-white hover:bg-primary-dark sm:flex-1">
          <DownloadIcon />
          {t("checker.result.getCert")}
        </button>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" />
    </svg>
  );
}

// ---- Step 4: the certificate ---------------------------------------------------------------------

function CertificateStep({ check, onClose }: { check: CheckView; onClose: () => void }) {
  const { t } = useI18n();
  const href = (format: "pdf" | "png") => `/api/logo-checks/${check.id}/certificate?format=${format}`;
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* A small drawing of the certificate with the real logo and number */}
          <div className="mx-auto flex w-[170px] shrink-0 flex-col items-center gap-2 rounded-[6px] bg-[#fffdf8] p-4 text-center shadow-[0_10px_30px_rgb(17_18_22/0.14)] ring-1 ring-[#e6c9c7]">
            <ShieldIcon className="size-5 text-primary" />
            <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink">{t("checker.cert.preview")}</span>
            <span className="flex size-16 items-center justify-center overflow-hidden rounded-[6px] bg-white ring-1 ring-[#e9e2d2]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {check.logoUrl && <img src={check.logoUrl} alt="" className="size-full object-contain p-1" />}
            </span>
            <span className="h-1 w-20 rounded-full bg-[#efe9db]" />
            <span className="h-1 w-14 rounded-full bg-[#efe9db]" />
            <span className="rounded-[5px] border border-line bg-white px-1.5 font-mono text-[10px] font-semibold text-ink">{certNumber(check.number)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-ink">{t("checker.cert.title")}</h2>
            <p className="m-0 mt-1 text-[15px] text-muted">{t("checker.cert.lead")}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a href={href("pdf")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-[15px] font-bold text-white hover:bg-primary-dark">
                <DownloadIcon />
                {t("checker.cert.pdf")}
              </a>
              <a href={href("png")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] border border-line px-4 text-[15px] font-bold text-ink hover:border-primary">
                <DownloadIcon />
                {t("checker.cert.image")}
              </a>
            </div>
            <a href={`/verify/${certNumber(check.number)}`} target="_blank" rel="noopener" className="mt-3 inline-flex min-h-11 items-center text-[14.5px] font-bold text-primary hover:underline">
              {t("checker.cert.verify")}
            </a>
          </div>
        </div>
        <p className="m-0 flex items-center gap-2 rounded-[12px] bg-success/10 px-3.5 py-3 text-[14.5px] text-success">
          <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          {t("checker.cert.saved")}
        </p>
      </div>
      <div className="sticky bottom-0 grid gap-2 border-t border-line bg-frame/95 px-4 py-3.5 backdrop-blur sm:grid-cols-2 sm:px-6">
        <Link href="/dashboard/logo-checks" className="inline-flex min-h-12 items-center justify-center rounded-[12px] border border-line bg-surface px-4 text-[15px] font-bold text-ink hover:border-primary">
          {t("checker.cert.seeAll")}
        </Link>
        <button type="button" onClick={onClose} className="inline-flex min-h-12 items-center justify-center rounded-[12px] bg-primary px-4 text-[15px] font-bold text-white hover:bg-primary-dark">
          {t("checker.cert.back")}
        </button>
      </div>
    </div>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";
import type { ClosestResult, MatchLevel } from "@/lib/logo-check/entry-rules";
import { formatTaka } from "@/lib/money";
import { LEVEL_TONE, ScoreRing, ShieldIcon } from "./match";

export type SendCheckSetup = {
  ready: boolean;
  usage: { pro: boolean; used: number; limit: number; left: number; resetsOn: string };
  priceBdt: number;
  proLogoChecks: number;
};

type Check = { id: string; reportId: string; status: "queued" | "running" | "done" | "failed"; step: number; score: number | null; level: MatchLevel | null; results: ClosestResult[] };
type Phase = "ready" | "checking" | "result" | "failed" | "nochecks" | "unavailable";

/**
 * Send a design with a logo check (owner, 2026-10-14; Design/logo-check/designer-send-with-check-and-verify.html).
 * Upload → Check → Send. The check is of the cover image as uploaded; the server makes the fingerprint and the
 * score, and the result goes on the entry by itself. Skipping sends without a check ("Not checked").
 */
export function SendCheckModal({
  open,
  onClose,
  contest,
  contestId,
  cover,
  setup,
  busy,
  onSend,
  onNewVersion,
}: {
  open: boolean;
  onClose: () => void;
  contest: string;
  contestId: string;
  cover: { path: string; url: string; name: string; kb: number | null; w: number; h: number } | null;
  setup: SendCheckSetup;
  busy: boolean;
  onSend: (checkId: string | null) => void;
  onNewVersion: () => void;
}) {
  const { t, locale } = useI18n();
  const [usage, setUsage] = useState(setup.usage);
  const [check, setCheck] = useState<Check | null>(null);
  const [checkedPath, setCheckedPath] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = (v: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(v);
  const plan = usage.pro ? "Pro" : "Basic";

  // A new cover means a new file: the old check is about another file.
  const current = check && cover && checkedPath === cover.path ? check : null;
  const phase: Phase = !setup.ready
    ? "unavailable"
    : current
      ? current.status === "failed"
        ? "failed"
        : current.status === "done"
          ? "result"
          : "checking"
      : usage.left <= 0
        ? "nochecks"
        : "ready";

  // Follow the check every 2 seconds until it is done.
  const polling = current && (current.status === "queued" || current.status === "running") ? current.id : null;
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!polling) return;
    timer.current = window.setInterval(async () => {
      const res = await fetch(`/api/entries/check?id=${polling}`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null);
      const k = res?.check as (Check & { usage: SendCheckSetup["usage"] }) | undefined;
      if (!k) return;
      setCheck({ id: k.id, reportId: k.reportId, status: k.status, step: k.step, score: k.score, level: k.level, results: k.results });
      setUsage(k.usage);
    }, 2000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [polling]);

  const start = async () => {
    if (!cover) return;
    setStarting(true);
    setError(null);
    const form = new FormData();
    form.set("contestId", contestId);
    form.set("requestKey", crypto.randomUUID());
    form.set("path", cover.path);
    const res = await fetch("/api/entries/check", { method: "POST", body: form })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "invalid" }));
    setStarting(false);
    if (!res.ok) {
      if (res.error === "limit") setUsage((u) => ({ ...u, left: 0 }));
      return setError(t(`entryCheck.send.errors.${(["limit", "closed", "bad_file", "not_found", "suspended", "not_set_up"].includes(res.error) ? res.error : "invalid") as "invalid"}`));
    }
    setCheckedPath(cover.path);
    setCheck({ id: res.id, reportId: res.reportId, status: "queued", step: 0, score: null, level: null, results: [] });
    setUsage((u) => ({ ...u, used: u.used + 1, left: Math.max(0, u.left - 1) }));
  };

  const steps: { key: "upload" | "check" | "send"; state: "done" | "active" | "todo" | "skipped" }[] = [
    { key: "upload", state: "done" },
    { key: "check", state: phase === "result" ? "done" : phase === "nochecks" || phase === "unavailable" ? "skipped" : "active" },
    { key: "send", state: phase === "result" || phase === "nochecks" || phase === "unavailable" ? "active" : "todo" },
  ];

  const leftLine = <p className="m-0 flex items-center gap-1.5 text-[13px] text-muted"><ShieldIcon className="size-3.5 text-success" />{t("entryCheck.send.left", { left: n(usage.left), limit: n(usage.limit), plan })}</p>;
  const sendWithout = (
    <Button variant="secondary" size="lg" block onClick={() => onSend(null)} loading={busy}>
      {t("entryCheck.send.skip")}
    </Button>
  );

  return (
    <Modal open={open} onClose={onClose} title={t("entryCheck.send.title", { contest })} closeLabel={t("common.close")}>
      <div className="space-y-4 text-ink">
        {/* Upload → Check → Send */}
        <ol className="m-0 grid list-none grid-cols-3 gap-1.5 p-0" aria-label={t("entryCheck.send.title", { contest })}>
          {steps.map((s, i) => (
            <li
              key={s.key}
              aria-current={s.state === "active" ? "step" : undefined}
              className={cx(
                "flex min-h-9 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[13px] font-bold",
                s.state === "done" ? "bg-[#e3f3ea] text-[#14633c]" : s.state === "active" ? "bg-ink text-white" : "bg-chip text-muted",
              )}
            >
              {s.state === "done" ? (
                <span className="flex size-[18px] items-center justify-center rounded-full bg-[#1f8a50] text-white" aria-hidden>
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </span>
              ) : (
                <span className={cx("flex size-[18px] items-center justify-center rounded-full text-[11px]", s.state === "active" ? "bg-white/20" : "bg-white")}>{n(i + 1)}</span>
              )}
              {t(`entryCheck.send.steps.${s.key}`)}
            </li>
          ))}
        </ol>

        {/* The cover that is checked */}
        {cover && (
          <div className="flex items-center gap-3">
            <img src={cover.url} alt="" className="size-14 shrink-0 rounded-[12px] bg-white object-contain ring-1 ring-line" />
            <div className="min-w-0">
              <p className="m-0 truncate font-bold">{cover.name}</p>
              <p className="m-0 text-[13px] text-muted">
                {cover.kb !== null ? `${n(cover.kb)} KB · ` : ""}
                {n(cover.w)} × {n(cover.h)} · {t("entryCheck.send.cover")}
              </p>
            </div>
          </div>
        )}

        {phase === "ready" && (
          <>
            <div className="rounded-[16px] bg-chip p-4">
              <p className="m-0 font-bold">{t("entryCheck.send.readyTitle")}</p>
              <p className="m-0 mt-1 text-[14px] text-muted">{t("entryCheck.send.readyLead")}</p>
              <p className="m-0 mt-2 text-[13px] font-semibold text-muted">{t("entryCheck.send.uses", { left: n(usage.left), limit: n(usage.limit), plan })}</p>
            </div>
            {error && <p className="m-0 text-[14px] font-semibold text-danger" role="alert">{error}</p>}
            <Button size="lg" block onClick={() => void start()} loading={starting}>
              <ShieldIcon className="size-[18px]" />
              {t("entryCheck.send.check")}
            </Button>
            {sendWithout}
          </>
        )}

        {phase === "checking" && current && (
          <>
            <div className="flex items-center gap-4 rounded-[16px] bg-chip p-4" aria-live="polite">
              <span className="relative flex size-12 shrink-0 items-center justify-center">
                <span className="absolute inset-0 animate-spin rounded-full border-4 border-line border-t-primary motion-reduce:animate-none" aria-hidden />
                <ShieldIcon className="size-5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 font-bold">{t("entryCheck.send.checking")}</p>
                <p className="m-0 text-[13px] text-muted">{t("entryCheck.send.checkingLead")}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div className="h-full rounded-full bg-[image:var(--gradient-red)] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(8, (current.step / 6) * 100)}%` }} />
                </div>
                <p className="m-0 mt-1 text-[12px] text-muted">{t("entryCheck.send.step", { n: n(Math.max(1, current.step)) })}</p>
              </div>
            </div>
            <div className="rounded-[16px] p-4 ring-1 ring-line">
              <p className="m-0 flex items-center gap-1.5 font-bold"><ShieldIcon className="size-4" />{t("entryCheck.send.skipTitle")}</p>
              <p className="m-0 mt-1 text-[14px] text-muted">{t("entryCheck.send.skipLead")}</p>
              <button type="button" onClick={() => onSend(null)} disabled={busy} className="mt-2 min-h-11 text-[15px] font-bold text-primary hover:underline disabled:opacity-50">
                {t("entryCheck.send.skip")}
              </button>
            </div>
          </>
        )}

        {phase === "result" && current && current.level && current.score !== null && (
          <>
            <div className={cx("flex items-start gap-4 rounded-[16px] p-4", LEVEL_TONE[current.level].soft)}>
              <ScoreRing score={current.score} level={current.level} />
              <div className="min-w-0">
                <p className="m-0 font-bold leading-snug">{t(`entryCheck.send.${current.level}Title`)}</p>
                <p className="m-0 mt-1 text-[14px] text-muted">{t(`entryCheck.send.${current.level}Lead`)}</p>
              </div>
            </div>
            {current.results.length > 0 && current.level !== "low" && (
              <div>
                <p className="m-0 text-[13px] font-bold text-muted">{t("entryCheck.send.closest")}</p>
                <ul className="m-0 mt-1 list-none space-y-1 p-0 text-[14px]">
                  {current.results.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 truncate font-semibold text-ink hover:text-primary">
                          {r.name}
                        </a>
                      ) : (
                        <span className="min-w-0 truncate font-semibold">{r.name}</span>
                      )}
                      <span className="shrink-0 text-muted">{t("entryCheck.send.similar", { n: n(r.similarity) })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {leftLine}
            {current.level === "high" ? (
              <>
                <Button size="lg" block onClick={onNewVersion}>
                  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
                  {t("entryCheck.send.newVersion")}
                </Button>
                <Button variant="secondary" size="lg" block onClick={() => onSend(current.id)} loading={busy}>
                  {t("entryCheck.send.sendAnyway")}
                </Button>
              </>
            ) : (
              <Button size="lg" block onClick={() => onSend(current.id)} loading={busy}>
                <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" /></svg>
                {t("entryCheck.send.sendDesign")}
              </Button>
            )}
          </>
        )}

        {phase === "failed" && (
          <>
            <div className="rounded-[16px] bg-chip p-4">
              <p className="m-0 font-bold">{t("entryCheck.send.failedTitle")}</p>
              <p className="m-0 mt-1 text-[14px] text-muted">{t("entryCheck.send.failedLead")}</p>
            </div>
            {error && <p className="m-0 text-[14px] font-semibold text-danger" role="alert">{error}</p>}
            {usage.left > 0 && (
              <Button size="lg" block onClick={() => void start()} loading={starting}>
                {t("entryCheck.send.retry")}
              </Button>
            )}
            {sendWithout}
          </>
        )}

        {phase === "nochecks" && (
          <>
            <div className="rounded-[16px] bg-chip p-4">
              <p className="m-0 flex items-start gap-2 font-bold">
                <ShieldIcon className="mt-0.5 size-4 text-muted" />
                {usage.pro ? t("entryCheck.send.usedAllPro", { n: n(usage.limit) }) : usage.limit === 1 ? t("entryCheck.send.usedAllOne") : t("entryCheck.send.usedAll", { n: n(usage.limit) })}
              </p>
              <p className="m-0 mt-1 text-[14px] text-muted">{t("entryCheck.send.resets", { date: formatDate(new Date(usage.resetsOn), locale, "short") })}</p>
            </div>
            {!usage.pro && (
              <div className="rounded-[16px] bg-[#fff8e6] p-4 ring-1 ring-[#f3dca0]">
                <div className="flex items-start gap-2.5">
                  <span className="rounded-full bg-[#e2b13c] px-2 py-0.5 text-[11px] font-bold text-[#4a3700]">PRO</span>
                  <div>
                    <p className="m-0 font-bold">{t("entryCheck.send.upsell", { n: n(setup.proLogoChecks) })}</p>
                    <p className="m-0 text-[13px] text-muted">{t("entryCheck.send.upsellPrice", { price: formatTaka(setup.priceBdt, locale) })}</p>
                  </div>
                </div>
                <Link href="/pro" className="mt-3 inline-flex min-h-11 items-center rounded-[12px] bg-surface px-4 text-[14px] font-bold text-ink ring-1 ring-line hover:ring-primary">
                  {t("entryCheck.send.seePro")}
                </Link>
              </div>
            )}
            <Button size="lg" block onClick={() => onSend(null)} loading={busy}>
              {t("entryCheck.send.skip")}
            </Button>
          </>
        )}

        {phase === "unavailable" && (
          <>
            <p className="m-0 rounded-[16px] bg-chip p-4 text-[14px] text-muted">{t("entryCheck.send.notReady")}</p>
            <Button size="lg" block onClick={() => onSend(null)} loading={busy}>
              {t("entryCheck.send.skip")}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

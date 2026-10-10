"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { buyAddon } from "@/lib/contests/addon-actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { useChecker } from "./checker-context";
import { ShieldIcon, VerdictPill } from "./parts";

/**
 * The "AI copyright checker" box beside the designs (owner, 2026-10-10; client-judging-page.html): active,
 * free and unused, locked add-on (buy it here), or all checks used.
 */
export function CheckerBox() {
  const { t, locale } = useI18n();
  const { setup, open } = useChecker();
  const [buying, setBuying] = useState(false);
  if (!setup) return null;
  const { state, designs } = setup;
  // After the winner is picked the box only stays for contests that have checks to look back at.
  if (!state.checkable && state.checks.length === 0) return null;
  const nf = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  const taka = (n: number) => `৳${nf.format(n)}`;
  const allUsed = state.access !== "locked" && state.left <= 0;
  const subtitle = state.access === "locked" ? t("checker.box.sub.locked") : allUsed ? t("checker.box.sub.used") : state.access === "free" ? t("checker.box.sub.free") : t("checker.box.sub.paid");
  const counted = state.checks.filter((c) => c.status !== "failed");
  const designOf = (entryId: string | null) => designs.find((d) => d.id === entryId) ?? null;

  return (
    <div className="lc-card shrink-0 overflow-hidden p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-tint text-primary">
          <ShieldIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 text-lg font-semibold leading-tight text-ink">{t("checker.title")}</h2>
          <p className="m-0 mt-0.5 text-[13px] text-muted">{subtitle}</p>
        </div>
      </div>

      {state.access === "locked" ? (
        <>
          <span className="mt-4 inline-flex rounded-full bg-[#ffedd5] px-2.5 py-0.5 text-[12.5px] font-bold text-[#9a3412]">{t("checker.box.lockedChip", { amount: taka(state.limits.freeFrom) })}</span>
          <p className="m-0 mt-2 text-[14.5px] text-ink">{t("checker.box.lockedLead", { n: nf.format(state.limits.perContest) })}</p>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[14px] bg-frame px-3.5 py-3">
            <span className="text-[14px] text-muted">{t("checker.box.checks", { n: nf.format(state.limits.perContest) })}</span>
            <span className="lc-d text-[22px] font-semibold text-ink">{taka(state.limits.price)}</span>
          </div>
          <Button block className="mt-3" disabled={!state.checkable} onClick={() => setBuying(true)}>
            {t("checker.box.add")}
          </Button>
          {!state.checkable && <p className="m-0 mt-2 text-[13px] text-muted">{t("checker.errors.closed")}</p>}
          <BuyChecker contestId={setup.contest.id} price={taka(state.limits.price)} n={nf.format(state.limits.perContest)} open={buying} onClose={() => setBuying(false)} />
        </>
      ) : (
        <>
          {state.access === "free" && counted.length === 0 && <span className="mt-4 inline-flex rounded-full bg-[#e3f3ea] px-2.5 py-0.5 text-[12.5px] font-bold text-[#14633c]">{t("checker.box.freeChip", { amount: taka(state.limits.freeFrom) })}</span>}
          <p className="m-0 mt-3 text-[14.5px] text-ink">{allUsed ? t("checker.box.allUsedLead") : t("checker.box.lead")}</p>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] bg-frame px-3.5 py-2.5">
            <span className="text-[14px] font-semibold text-ink">{t("checker.usedOf", { used: nf.format(state.used), limit: nf.format(state.limits.perContest) })}</span>
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: state.limits.perContest }, (_, i) => (
                <span key={i} className={cx("h-1.5 w-5 rounded-full", i < state.used ? "bg-primary" : "bg-line")} />
              ))}
            </span>
          </div>

          {!allUsed && (
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              {Array.from({ length: state.limits.perContest }, (_, i) => {
                const c = counted[i];
                if (!c)
                  return (
                    <li key={i} className="flex min-h-12 items-center rounded-[12px] border border-dashed border-line px-3.5 text-[13.5px] text-muted">
                      {t("checker.box.slot", { n: nf.format(i + 1) })}
                    </li>
                  );
                const d = designOf(c.entryId);
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => open({ checkId: c.id, step: c.status === "done" ? 3 : undefined })} className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left ring-1 ring-line hover:ring-primary">
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white ring-1 ring-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {d?.coverUrl ? <img src={d.coverUrl} alt="" className="size-full object-contain" /> : <ShieldIcon className="size-4 text-muted" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold text-ink">{c.entryNumber ? t("checker.choose.design", { n: nf.format(c.entryNumber) }) : t("checker.choose.uploaded")}</span>
                        {c.status === "done" && c.verdict ? <VerdictPill verdict={c.verdict} className="mt-0.5 !px-2 !text-[12px]" /> : <span className="text-[12.5px] text-primary">{t("checker.box.running")}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {allUsed ? (
            <Link href="/dashboard/logo-checks" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[12px] border border-line text-[15px] font-bold text-ink hover:border-primary">
              {t("checker.box.seeAll")}
            </Link>
          ) : (
            <Button block className="mt-3" disabled={!state.checkable || !setup.ready} onClick={() => open({})}>
              <ShieldIcon className="size-4" />
              {t("checker.box.check")}
            </Button>
          )}
          {!state.checkable ? <p className="m-0 mt-2 text-[13px] text-muted">{t("checker.errors.closed")}</p> : !setup.ready && <p className="m-0 mt-2 text-[13px] text-muted">{t("checker.errors.not_set_up")}</p>}
        </>
      )}
      <p className="m-0 mt-3 text-[12.5px] text-muted">{t("checker.note")}</p>
    </div>
  );
}

/** Buying the checker add-on: bKash or card, then the gateway (the same flow as the other add-ons). */
function BuyChecker({ contestId, price, n, open, onClose }: { contestId: string; price: string; n: string; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [method, setMethod] = useState<"bkash" | "card">("bkash");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const pay = () =>
    start(async () => {
      setError(null);
      const res = await buyAddon({ contestId, addon: "logo_scan", method });
      if (!res.ok) return setError(t(res.error));
      window.location.href = res.redirectUrl;
    });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("checker.title")}
      closeLabel={t("common.close")}
      footer={
        <div className="w-full space-y-2">
          {error && <Alert tone="danger">{error}</Alert>}
          <Button block size="lg" onClick={pay} loading={busy}>
            {t("manage.addons.pay", { amount: price })}
          </Button>
        </div>
      }
    >
      <p className="text-ink">{t("checker.box.buyLine", { n })}</p>
      <p className="mt-5 text-sm font-medium text-ink">{t("manage.addons.payWith")}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["bkash", "card"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            aria-pressed={method === m}
            className={cx("min-h-12 rounded-[14px] text-sm font-semibold ring-1 transition-colors", method === m ? "bg-ink text-white ring-ink" : "text-ink ring-line hover:bg-chip")}
          >
            {t(`wizard.c11.${m}`)}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Under each design card: "Check with AI", or the result and "Certificate" once it was checked. */
export function CheckCardAction({ entryId }: { entryId: string }) {
  const { t } = useI18n();
  const { setup, open } = useChecker();
  if (!setup) return null;
  const c = setup.state.checks.find((x) => x.entryId === entryId && x.status !== "failed");
  if (c?.status === "done" && c.verdict)
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => open({ checkId: c.id, step: 3 })} className="min-w-0">
          <VerdictPill verdict={c.verdict} className="!px-2 !text-[11.5px]" />
        </button>
        <button type="button" onClick={() => open({ checkId: c.id, step: 4 })} className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[13px] font-bold text-primary hover:bg-tint">
          {t("checker.card.certificate")}
        </button>
      </div>
    );
  if (c)
    return (
      <button type="button" onClick={() => open({ checkId: c.id })} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[13px] font-bold text-primary hover:bg-tint">
        <span className="size-3 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-hidden />
        {t("checker.card.checking")}
      </button>
    );
  if (setup.state.access === "locked" || !setup.state.checkable || setup.state.left <= 0) return null;
  return (
    <button type="button" onClick={() => open({ entryId })} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-primary ring-1 ring-primary/40 hover:bg-tint">
      <ShieldIcon className="size-3.5" />
      {t("checker.card.check")}
    </button>
  );
}

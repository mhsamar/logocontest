"use client";

import Link from "next/link";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { ContestCheckCount, MyCheck } from "@/lib/logo-check/queries";
import { certNumber } from "@/lib/logo-check/rules";
import { CheckerProvider, useChecker } from "./checker-context";
import { ShieldIcon, VerdictPill } from "./parts";

const lc = (n: number | null) => (n ? `LC-${String(n).padStart(4, "0")}` : null);

/** The list on My logo checks (owner, 2026-10-10). */
export function MyChecksList({ checks, contests, limit, lens }: { checks: MyCheck[]; contests: ContestCheckCount[]; limit: number; lens: boolean }) {
  return (
    <CheckerProvider setup={null} lens={lens}>
      <Body checks={checks} contests={contests} limit={limit} />
    </CheckerProvider>
  );
}

function Body({ checks, contests, limit }: { checks: MyCheck[]; contests: ContestCheckCount[]; limit: number }) {
  const { t, locale } = useI18n();
  const { open } = useChecker();
  const nf = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  const when = (iso: string) => new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" });
  const done = checks.filter((c) => c.status === "done");
  const counted = checks.filter((c) => c.status !== "failed");
  const left = contests.filter((c) => c.checkable && c.access !== "locked").reduce((n, c) => n + c.left, 0);
  const contestCount = new Set(counted.map((c) => c.contest.id)).size;

  const tile = "rounded-[20px] p-5 ring-1";
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={cx(tile, "bg-[image:var(--gradient-red)] text-white ring-transparent")}>
          <p className="m-0 text-[14px] text-white/80">{t("checker.my.checked")}</p>
          <p className="lc-d m-0 mt-1 text-[34px] font-semibold leading-none">{nf.format(counted.length)}</p>
          <p className="m-0 mt-2 text-[13.5px] text-white/80">{t("checker.my.inContests", { n: nf.format(contestCount) })}</p>
        </div>
        <div className={cx(tile, "bg-surface ring-line")}>
          <p className="m-0 text-[14px] text-muted">{t("checker.my.certificates")}</p>
          <p className="lc-d m-0 mt-1 text-[34px] font-semibold leading-none text-ink">{nf.format(done.length)}</p>
          <p className="m-0 mt-2 text-[13.5px] text-muted">{t("checker.my.certificatesLine")}</p>
        </div>
        <div className={cx(tile, "bg-surface ring-line")}>
          <p className="m-0 text-[14px] text-muted">{t("checker.my.left")}</p>
          <p className="lc-d m-0 mt-1 text-[34px] font-semibold leading-none text-ink">{nf.format(left)}</p>
          <p className="m-0 mt-2 truncate text-[13.5px] text-muted">{contests.filter((c) => c.checkable && c.access !== "locked" && c.left > 0).map((c) => c.brand).join(" · ") || "—"}</p>
        </div>
      </div>

      <section>
        <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-ink">{t("checker.my.listTitle")}</h2>
        {checks.length === 0 ? (
          <div className="mt-3 rounded-[20px] border border-dashed border-line bg-surface px-5 py-10 text-center">
            <ShieldIcon className="mx-auto size-7 text-primary" />
            <p className="m-0 mt-3 text-[17px] font-semibold text-ink">{t("checker.my.emptyTitle")}</p>
            <p className="m-0 mt-1 text-[15px] text-muted">{t("checker.my.emptyBody")}</p>
            <Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center rounded-[12px] bg-primary px-5 text-[15px] font-bold text-white hover:bg-primary-dark">
              {t("checker.my.toContests")}
            </Link>
          </div>
        ) : (
          <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
            {checks.map((c) => (
              <li key={c.id} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-[18px] bg-surface p-3.5 ring-1 ring-line md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
                <span className="flex size-14 items-center justify-center overflow-hidden rounded-[12px] bg-white ring-1 ring-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.logoUrl ? <img src={c.logoUrl} alt="" className="size-full object-contain p-1" /> : <ShieldIcon className="size-5 text-muted" />}
                </span>
                <div className="min-w-0">
                  <p className="m-0 flex flex-wrap items-center gap-2 text-[16px] font-semibold text-ink">
                    {c.entryNumber ? t("checker.choose.design", { n: nf.format(c.entryNumber) }) : t("checker.choose.uploaded")}
                    <span className="rounded-[7px] border border-line bg-surface px-1.5 font-mono text-[12px] font-semibold text-ink">{certNumber(c.number)}</span>
                  </p>
                  <p className="m-0 mt-0.5 truncate text-[13.5px] text-muted">
                    {c.contest.brand}
                    {lc(c.contest.number) ? ` · ${lc(c.contest.number)}` : ""}
                  </p>
                  <p className="m-0 text-[13px] text-muted">
                    {when(c.createdAt)} · {c.paid ? t("checker.my.addon") : t("checker.my.free")}
                  </p>
                </div>
                <div className="col-span-2 min-w-0 md:col-span-1">
                  {c.status === "done" && c.verdict ? (
                    <>
                      <VerdictPill verdict={c.verdict} />
                      <p className="m-0 mt-1 text-[13px] text-muted">{c.close ? t("checker.my.closeLine", { n: nf.format(c.close), pct: nf.format(c.closest) }) : t("checker.my.noneLine")}</p>
                    </>
                  ) : c.status === "failed" ? (
                    <p className="m-0 text-[13.5px] text-muted">{t("checker.my.failed")}</p>
                  ) : (
                    <p className="m-0 flex items-center gap-2 text-[13.5px] font-semibold text-primary">
                      <span className="size-3 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-hidden />
                      {t("checker.box.running")}
                    </p>
                  )}
                </div>
                <div className="text-center max-md:hidden">
                  {c.overall !== null && (
                    <>
                      <p className="lc-d m-0 text-[24px] font-semibold leading-none text-ink">{nf.format(c.overall)}</p>
                      <p className="m-0 mt-1 text-[12px] text-muted">{t("checker.scores.overall")}</p>
                    </>
                  )}
                </div>
                <div className="col-span-2 flex gap-2 md:col-span-1">
                  {c.status !== "failed" && (
                    <button type="button" onClick={() => open({ checkId: c.id, step: c.status === "done" ? 3 : undefined })} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[12px] border border-line px-4 text-[14.5px] font-bold text-ink hover:border-primary md:flex-none">
                      {t("checker.my.see")}
                    </button>
                  )}
                  {c.status === "done" && (
                    <a href={`/api/logo-checks/${c.id}/certificate?format=pdf`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-primary px-4 text-[14.5px] font-bold text-white hover:bg-primary-dark md:flex-none">
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" />
                      </svg>
                      PDF
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {contests.length > 0 && (
        <section>
          <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-ink">{t("checker.my.perContest")}</h2>
          <ul className="m-0 mt-3 grid list-none gap-3 p-0 sm:grid-cols-2">
            {contests.map((c) => (
              <li key={c.id} className="rounded-[18px] bg-surface p-4 ring-1 ring-line">
                <Link href={`/dashboard/contests/${c.slug}`} className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-ink hover:text-primary">
                  {c.brand}
                  {lc(c.number) && <span className="rounded-[7px] border border-line px-1.5 font-mono text-[12px] font-semibold">{lc(c.number)}</span>}
                </Link>
                {c.access === "locked" ? (
                  <p className="m-0 mt-2 text-[14px] text-muted">{t("checker.my.lockedLine")}</p>
                ) : (
                  <>
                    <div className="mt-2.5 flex items-center justify-between gap-3 rounded-[12px] bg-frame px-3.5 py-2.5">
                      <span className="text-[14px] font-semibold text-ink">{t("checker.usedOf", { used: nf.format(c.used), limit: nf.format(limit) })}</span>
                      <span className="flex gap-1" aria-hidden>
                        {Array.from({ length: limit }, (_, i) => (
                          <span key={i} className={cx("h-1.5 w-5 rounded-full", i < c.used ? "bg-primary" : "bg-line")} />
                        ))}
                      </span>
                    </div>
                    <p className="m-0 mt-2 text-[13.5px] text-muted">
                      {c.access === "free" ? t("checker.my.free") : t("checker.my.addon")} · {c.checkable ? t("checker.my.leftLine", { n: nf.format(c.left) }) : t("checker.my.closed")}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

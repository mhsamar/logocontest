import Link from "next/link";
import { AdminIcon } from "@/components/admin/icons";
import { AdmCard } from "@/components/admin/ui";
import { biggestDrops, PAID, RANGES, unpaidHref, type FunnelStep, type UnpaidQuery } from "@/lib/admin/unpaid-rules";
import { cx } from "@/lib/cx";
import type { MessageKey, Translate } from "@/lib/i18n/translate";

/**
 * Admin › Unpaid contests (owner, 2026-10-25; Design/unpaid-contests): the six numbers, "Where they get stuck" and the
 * Follow-up plan. Every number and every step links into the list below.
 */

export type StatCard = { key: string; label: string; value: string; hint: string; href: string; tone: "plain" | "money" | "today" | "overdue" | "won" };

const TONE: Record<StatCard["tone"], { card: string; value: string; text: string }> = {
  plain: { card: "border-adm-line bg-surface", value: "text-ink", text: "text-muted" },
  money: { card: "border-primary bg-[linear-gradient(135deg,#8B0000,#5C0A0C)]", value: "text-white", text: "text-[#F6DAD8]" },
  today: { card: "border-[#F2D9A8] bg-[#FFF8EC]", value: "text-[#8A5A00]", text: "text-muted" },
  overdue: { card: "border-[#F3D2CF] bg-[#FFF8F7]", value: "text-adm-bad", text: "text-muted" },
  won: { card: "border-adm-line bg-surface", value: "text-adm-good text-[22px]", text: "text-muted" },
};

export function UnpaidStats({ cards, showLabel }: { cards: StatCard[]; showLabel: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 min-[641px]:grid-cols-3 min-[1251px]:grid-cols-6">
      {cards.map((c) => {
        const tone = TONE[c.tone];
        return (
          <Link key={c.key} href={c.href} title={showLabel} className={cx("group flex min-w-0 flex-col gap-1 rounded-[18px] border px-[18px] py-4 transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_rgba(17,18,22,.35)]", tone.card)}>
            <span className={cx("flex items-center justify-between gap-2 text-[13.5px] font-bold", tone.text)}>
              <span className="truncate">{c.label}</span>
              <AdminIcon name="arrow" size={14} className="shrink-0 opacity-45 transition-transform group-hover:opacity-100 motion-safe:group-hover:translate-x-[3px]" />
            </span>
            <b className={cx("lc-d whitespace-nowrap text-[26px] font-semibold tracking-[-0.02em] tabular-nums", tone.value)}>{c.value}</b>
            <em className={cx("text-[12.5px] not-italic", tone.text)}>{c.hint}</em>
          </Link>
        );
      })}
    </div>
  );
}

const SEG = "inline-flex min-h-9 items-center rounded-[10px] px-3 text-[13.5px] font-bold transition-colors";
const segOn = (on: boolean) => (on ? "bg-[#111216] text-white" : "bg-[#F4F5F7] text-ink hover:bg-[#ECEDF0]");

/** "Where they get stuck" (handoff §4): the stages with how many reached each and the drop from the one before. */
export function StuckFunnel({ funnel, q, t, num, stepName, empty }: { funnel: FunnelStep[]; q: UnpaidQuery; t: Translate; num: (n: number) => string; stepName: (n: number) => string; empty: string }) {
  const top = Math.max(1, funnel[0]?.count ?? 0);
  const none = (funnel[0]?.count ?? 0) === 0;
  const drops = biggestDrops(funnel, 2);
  const stepHref = (n: number) => (n === PAID ? unpaidHref(q, { tab: "won", step: null, sel: null }, "#ulist") : unpaidHref(q, { step: q.step === n ? null : n, tab: "all", sel: null }, "#ulist"));
  return (
    <AdmCard as="section" className="flex flex-col gap-4 p-5" data-unpaid-funnel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em]">{t("admin.unpaid.fu.funnel.title")}</h2>
          <p className="m-0 mt-1 text-[14px] text-muted">
            {t(`admin.unpaid.fu.funnel.sub.${q.range}` as MessageKey)} {t("admin.unpaid.fu.funnel.click")}
          </p>
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label={t("admin.unpaid.fu.funnel.title")}>
          {RANGES.map((r) => (
            <Link key={r} href={unpaidHref(q, { range: r })} scroll={false} aria-current={q.range === r ? "true" : undefined} className={cx(SEG, segOn(q.range === r))}>
              {t(`admin.unpaid.fu.funnel.ranges.${r}` as MessageKey)}
            </Link>
          ))}
        </nav>
      </div>
      {none ? (
        <p className="m-0 text-[15px] text-muted">{empty}</p>
      ) : (
        <>
          <ol className="m-0 grid list-none grid-cols-5 gap-x-1.5 gap-y-3 p-0 min-[901px]:grid-cols-10">
            {funnel.map((s) => {
              const on = q.step === s.n;
              return (
                <li key={s.n} className="min-w-0">
                  <Link
                    href={stepHref(s.n)}
                    aria-current={on ? "true" : undefined}
                    aria-label={t("admin.unpaid.fu.funnel.reached", { n: num(s.count), step: stepName(s.n) })}
                    className={cx("flex flex-col items-center gap-1 rounded-[12px] px-0.5 py-1.5 text-center hover:bg-[#FAFAFB]", on && "bg-[#FFF3F2] ring-1 ring-inset ring-[#F3D2CF]")}
                  >
                    <span className="relative h-[120px] w-full max-w-[46px] overflow-hidden rounded-[10px] bg-[#F4F5F7]">
                      <span className={cx("absolute inset-x-0 bottom-0 rounded-[10px]", s.n === PAID ? "bg-[linear-gradient(180deg,#2BB673,#14633C)]" : "bg-[linear-gradient(180deg,#B3261E,#8B0000)]")} style={{ height: `${Math.round((s.count / top) * 100)}%` }} />
                    </span>
                    <b className="text-[15px] tabular-nums">{num(s.count)}</b>
                    <em className="min-h-[28px] text-[11.5px] not-italic leading-tight text-muted">{stepName(s.n)}</em>
                    <i className={cx("text-[11.5px] font-bold not-italic", s.drop ? "text-[#B3261E]" : "text-[#8A8C96]")}>{s.drop === null ? t("admin.unpaid.fu.funnel.start") : s.drop ? `−${num(s.drop)}` : num(0)}</i>
                  </Link>
                </li>
              );
            })}
          </ol>
          {drops.length > 0 && (
            <div className="grid gap-3 min-[1001px]:grid-cols-[auto_1fr_1fr]">
              <div className="flex items-center gap-2 min-[1001px]:flex-col min-[1001px]:items-start min-[1001px]:justify-center">
                <AdminIcon name="warning" size={18} className="text-[#8A5A00]" />
                <b className="lc-d text-[16px] font-semibold">{t("admin.unpaid.fu.funnel.drops")}</b>
                <em className="text-[13px] not-italic text-muted">{t("admin.unpaid.fu.funnel.dropsSub")}</em>
              </div>
              {drops.map((d, i) => (
                <div key={d.from} className="flex flex-col gap-2.5 rounded-[16px] border border-[#F3D2CF] bg-[linear-gradient(160deg,#FFF8F7,#fff)] px-4 py-3.5">
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-[9px] bg-[image:var(--gradient-red)] text-[14px] font-bold text-white">{num(i + 1)}</span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="rounded-[8px] bg-surface px-2 py-0.5 text-[13.5px] font-bold ring-1 ring-inset ring-[#EFD6D3]">{stepName(d.from)}</span>
                      <AdminIcon name="arrow" size={14} className="text-[#B3261E]" />
                      <span className="rounded-[8px] bg-surface px-2 py-0.5 text-[13.5px] font-bold ring-1 ring-inset ring-[#EFD6D3]">{stepName(d.to)}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <b className="lc-d text-[24px] font-semibold text-[#B3261E]">−{num(d.lost)}</b>
                      <em className="text-[12px] not-italic text-muted">{t("admin.unpaid.fu.funnel.lost", { pct: num(d.pct) })}</em>
                    </span>
                  </div>
                  <span className="h-1.5 overflow-hidden rounded-full bg-[#F6E3E1]">
                    <span className="block h-full rounded-full bg-[linear-gradient(90deg,#D9A52B,#B3261E)]" style={{ width: `${Math.min(100, d.pct)}%` }} />
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 min-w-[200px] flex-1 text-[13px] text-muted">{t(`admin.unpaid.fu.funnel.tips.d${d.from}` as MessageKey)}</p>
                    <Link href={unpaidHref(q, { tab: "all", step: d.from, sel: null }, "#ulist")} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-[#E3E4E8] bg-surface px-3 text-[13px] font-bold hover:border-primary hover:text-primary max-[520px]:w-full max-[520px]:justify-center">
                      {t("admin.unpaid.fu.funnel.see")}
                      <AdminIcon name="arrow" size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AdmCard>
  );
}

export type PlanItem = { key: string; brand: string; at: Date; type: string; done: boolean; group: "overdue" | "today" | "tomorrow" | "later" };

/** The Follow-up plan (handoff §8): overdue, today (done ones struck through), tomorrow and later. */
export function FollowUpPlan({ items, q, t, label }: { items: PlanItem[]; q: UnpaidQuery; t: Translate; label: (i: PlanItem) => string }) {
  const groups = (["overdue", "today", "tomorrow", "later"] as const).map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter((x) => x.list.length);
  return (
    <AdmCard as="section" className="flex flex-col gap-3 p-5" data-unpaid-plan>
      <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em]">{t("admin.unpaid.fu.plan.title")}</h2>
      {groups.length === 0 ? (
        <p className="m-0 text-[15px] text-muted">{t("admin.unpaid.fu.plan.empty")}</p>
      ) : (
        <div className="grid gap-4 min-[901px]:grid-cols-2 min-[1251px]:grid-cols-4">
          {groups.map(({ g, list }) => (
            <div key={g} className="flex min-w-0 flex-col gap-2">
              <h3 className={cx("m-0 text-[12px] font-extrabold uppercase tracking-[0.08em]", g === "overdue" ? "text-[#B3261E]" : "text-[#8A8C96]")}>{t(`admin.unpaid.fu.plan.${g}`)}</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {list.slice(0, 12).map((i) => (
                  <li key={`${i.key}-${i.at.getTime()}`}>
                    <Link
                      href={unpaidHref(q, { sel: i.key }, "#lead")}
                      className={cx("flex items-center gap-3 rounded-[12px] border px-3 py-2.5 hover:border-primary", g === "overdue" ? "border-[#F3D2CF] bg-[#FFF8F7]" : "border-adm-line-soft bg-[#FAFAFB]", i.done && "opacity-60")}
                    >
                      <b className={cx("min-w-[52px] text-[13px] tabular-nums", g === "overdue" && "text-[#B3261E]")}>{label(i)}</b>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <strong className={cx("truncate text-[14px]", i.done && "line-through")}>{i.brand || "—"}</strong>
                        <em className="text-[12.5px] not-italic text-muted">{t(`admin.unpaid.fu.type.${i.type}` as MessageKey)}</em>
                      </span>
                      {i.done && (
                        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#2BB673] text-white">
                          <AdminIcon name="check" size={13} />
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </AdmCard>
  );
}

import Link from "next/link";
import { cx } from "@/lib/cx";
import { AdminIcon, type AdminIconName } from "./icons";

/**
 * Shared admin pieces (design/admin/ADMIN-HANDOFF.md, owner 2026-10-10): card, pill, KPI tile, tabs,
 * ID chip and checkbox. Every admin page uses these instead of styling its own.
 */

/** White card: 1px line, 16px corners. */
export function AdmCard({ as: Tag = "section", className, children, ...rest }: { as?: "section" | "div" | "article" | "aside" | "li"; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cx("rounded-[16px] border border-adm-line bg-surface shadow-[0_1px_2px_rgb(17_18_22/0.03)]", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** A card's title row: heading, optional line under it, and an action on the right. */
export function CardTitle({ title, sub, action }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em] text-ink">{title}</h2>
        {sub && <p className="m-0 mt-1 text-[14.5px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** A card whose wide table scrolls inside it, so the page never scrolls sideways (rule 4). */
export function TableCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <AdmCard className={cx("overflow-hidden", className)}>
      <div className="overflow-x-auto">{children}</div>
    </AdmCard>
  );
}

export type PillTone = "good" | "warn" | "bad" | "sample" | "brand" | "neutral" | "dark" | "red" | "gold";
const PILL: Record<PillTone, string> = {
  good: "bg-adm-good-bg text-adm-good",
  warn: "bg-adm-warn-bg text-adm-warn",
  bad: "bg-adm-bad-bg text-adm-bad",
  sample: "bg-adm-sample-bg text-adm-sample",
  brand: "bg-tint text-primary",
  neutral: "bg-[#f0f1f4] text-adm-strong",
  dark: "bg-ink text-white",
  red: "bg-primary text-white",
  gold: "bg-gold text-gold-ink",
};

export function Pill({ tone = "neutral", className, children }: { tone?: PillTone; className?: string; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-[9px] py-0.5 text-[12.5px] font-bold", PILL[tone], className)}>{children}</span>;
}

/** KPI tile: label, big number, optional line under it, and an icon square. `accent` is the red tile. */
export function KpiTile({ label, value, hint, icon, href, accent = false }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: AdminIconName; href?: string; accent?: boolean }) {
  const body = (
    <>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className={cx("text-[14.5px] font-semibold", accent ? "text-[#f6dad8]" : "text-muted")}>{label}</span>
        <span className="lc-d truncate text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[34px]">{value}</span>
        {hint && <span className={cx("text-sm", accent ? "text-[#f6dad8]" : "text-muted")}>{hint}</span>}
      </div>
      {icon && (
        <span className={cx("hidden size-11 shrink-0 items-center justify-center rounded-[12px] sm:flex", accent ? "bg-white/15 text-white" : "bg-tint text-primary")}>
          <AdminIcon name={icon} />
        </span>
      )}
    </>
  );
  const box = cx(
    "flex h-full items-start justify-between gap-3 rounded-[16px] border p-4 shadow-[0_1px_2px_rgb(17_18_22/0.03)] sm:p-5",
    accent ? "border-primary bg-primary text-white" : "border-adm-line bg-surface text-ink",
  );
  return href ? (
    <Link href={href} className={cx(box, "transition-colors", accent ? "hover:bg-adm-deep" : "hover:border-[#d6d8de]")}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

/** A grid of KPI tiles: two across on phones, as many as fit from 230px up. */
export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] sm:gap-4">{children}</div>;
}

/** Link tabs / period switcher in a white box; the current one is red. */
export function Tabs({ label, items, className }: { label: string; items: { href: string; label: React.ReactNode; active: boolean; count?: number; icon?: AdminIconName }[]; className?: string }) {
  return (
    <nav aria-label={label} className={cx("max-w-full overflow-x-auto [scrollbar-width:none]", className)}>
      <ul className="m-0 flex w-max list-none gap-1 rounded-[14px] border border-adm-line bg-surface p-1">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={it.active ? "page" : undefined}
              className={cx(
                "flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] px-4 text-[15px] font-bold transition-colors",
                it.active ? "bg-primary text-white" : "text-adm-strong hover:bg-adm-bg",
              )}
            >
              {it.icon && <AdminIcon name={it.icon} size={16} />}
              {it.label}
              {it.count !== undefined && <span className={cx("rounded-[7px] px-1.5 text-[12.5px] tabular-nums", it.active ? "bg-white/20" : "bg-[#f0f1f4]")}>{it.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "LC-0005", "TK-0001", "CC-0001": the prefix and the number padded to four digits. */
export function formatId(prefix: "LC" | "TK" | "CC", n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export function IdChip({ prefix, n, className }: { prefix: "LC" | "TK" | "CC"; n: number | null; className?: string }) {
  if (n === null) return null;
  return <span className={cx("inline-flex items-center self-start rounded-[7px] border border-[#e3e4e8] bg-surface px-2 py-0.5 font-mono text-[12.5px] font-semibold tracking-[0.04em] text-adm-strong", className)}>{formatId(prefix, n)}</span>;
}

/** Checkbox in the admin style (24px box, red when ticked) with a 44px touch area. */
export function AdmCheckbox({ label, className, ...rest }: { label?: React.ReactNode; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={cx("inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] font-medium text-ink", className)}>
      <span className="relative flex size-6 shrink-0">
        <input
          type="checkbox"
          className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[7px] border-2 border-[#b9bcc4] bg-surface checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          {...rest}
        />
        <AdminIcon name="check" size={16} className="pointer-events-none relative m-auto hidden text-white peer-checked:block" />
      </span>
      {label}
    </label>
  );
}

/** Four small bars for a contest's stage: `step` of them red, or all green when `done`. */
export function StageSteps({ step, done = false }: { step: number; done?: boolean }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={cx("h-1.5 w-[26px] rounded-full", i <= step ? (done ? "bg-adm-pay" : "bg-primary") : "bg-[#e3e4e8]")} />
      ))}
    </span>
  );
}

/** "29 days left" chip: orange, red in the last day. */
export function TimeLeft({ children, urgent = false }: { children: React.ReactNode; urgent?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-[5px] text-sm font-bold", urgent ? "bg-adm-bad-bg text-adm-bad" : "bg-adm-warn-bg text-adm-warn")}>
      <AdminIcon name="unpaid" size={15} />
      {children}
    </span>
  );
}

/** Text inputs, selects and date fields in the admin style: 48px tall, 12px corners. */
export const ADM_INPUT = "h-12 w-full rounded-[12px] border border-[#dcdee3] bg-surface px-3.5 text-[15.5px] font-medium text-ink focus:outline-2 focus:outline-offset-1 focus:outline-primary";

/** Empty state inside a card. */
export function AdmEmpty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 rounded-[12px] bg-adm-bg px-4 py-8 text-center text-[15px] text-muted">{children}</p>;
}

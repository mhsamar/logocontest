import Link from "next/link";
import { Pill } from "./ui";

/** Small shared pieces for admin lists (server components). */

/** The older status pill, now drawn with the shared admin Pill (ok = good, muted = neutral). */
export function StatusPill({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  return <Pill tone={tone === "ok" ? "good" : tone === "muted" ? "neutral" : tone}>{children}</Pill>;
}

/** A GET form for filters: changing anything reloads the list with the new query. */
export function FilterBar({ action, children }: { action: string; children: React.ReactNode }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-[16px] border border-adm-line bg-surface p-3">
      {children}
    </form>
  );
}

export const FILTER_INPUT = "h-11 rounded-[12px] border border-[#dcdee3] bg-surface px-3 text-[15px] font-medium text-ink focus:outline-2 focus:outline-offset-1 focus:outline-primary";

export function Pager({ page, pages, href, prev, next, label }: { page: number; pages: number; href: (p: number) => string; prev: string; next: string; label: string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label={label}>
      {page > 1 ? (
        <Link href={href(page - 1)} className="inline-flex h-11 items-center rounded-[12px] border border-adm-line bg-surface px-4 font-bold text-adm-strong hover:border-primary hover:text-primary">
          ← {prev}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="inline-flex h-11 items-center rounded-[12px] border border-adm-line bg-surface px-4 font-bold text-adm-strong hover:border-primary hover:text-primary">
          {next} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Builds a query string from the current filters, leaving out empty values. */
export function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== 1) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
export const pageNum = (v: string | string[] | undefined) => Math.max(1, Math.floor(Number(typeof v === "string" ? v : 1)) || 1);

export const contestTone = (s: string): "ok" | "warn" | "bad" | "muted" =>
  s === "open" ? "ok" : s === "cancelled" ? "bad" : s === "judging" || s === "handover" || s === "winner_selected" ? "warn" : "muted";

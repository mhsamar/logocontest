import Link from "next/link";
import { cx } from "@/lib/cx";

/** Small shared pieces for admin lists (server components). */

export function StatusPill({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  const tones = { ok: "bg-success/10 text-success", warn: "bg-[#fff7e0] text-[#8a5105]", bad: "bg-danger/10 text-danger", muted: "bg-canvas text-muted" };
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

/** A GET form for filters: changing anything reloads the list with the new query. */
export function FilterBar({ action, children }: { action: string; children: React.ReactNode }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-line">
      {children}
    </form>
  );
}

export const FILTER_INPUT = "min-h-10 rounded-lg bg-canvas px-3 text-sm text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary";

export function Pager({ page, pages, href, prev, next, label }: { page: number; pages: number; href: (p: number) => string; prev: string; next: string; label: string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label={label}>
      {page > 1 ? (
        <Link href={href(page - 1)} className="inline-flex min-h-10 items-center rounded-full bg-surface px-4 font-semibold ring-1 ring-line hover:ring-primary">
          ← {prev}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="inline-flex min-h-10 items-center rounded-full bg-surface px-4 font-semibold ring-1 ring-line hover:ring-primary">
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

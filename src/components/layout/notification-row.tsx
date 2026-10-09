import { cx } from "@/lib/cx";
import { CATEGORY_STYLE } from "@/lib/notifications/categories";
import type { ShownNotification } from "@/lib/notifications/render";

/** One notification: a coloured icon and label for its category (owner, 2026-10-09), the text, and how long ago. */
export function NotificationRow({ n, label, size = "md" }: { n: ShownNotification; label: string; size?: "sm" | "md" }) {
  const style = CATEGORY_STYLE[n.category];
  return (
    <>
      <span className={cx("flex shrink-0 items-center justify-center rounded-full", size === "sm" ? "size-9" : "size-10", style.tile)} aria-hidden>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={style.d} />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("mb-1 inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide", style.chip)}>{label}</span>
        <span className={cx("block leading-snug", size === "sm" ? "text-sm" : "", n.read ? "text-muted" : "font-medium text-ink")}>{n.text}</span>
        <span className="mt-0.5 block text-xs text-muted">{n.ago}</span>
      </span>
      {!n.read && <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", style.bar)} aria-hidden />}
    </>
  );
}

import Link from "next/link";
import { cx } from "@/lib/cx";

/**
 * "Message designer" (owner, 2026-10-13; 2026-10-16: also on the client's own contest page, and for Pro Trial
 * designers): opens the chat about this one design in Messages. Shown only where `chattableEntries` allows it.
 */
export function MessageDesignerLink({ entryId, label, size = "lg", className }: { entryId: string; label: string; size?: "lg" | "sm"; className?: string }) {
  return (
    <Link
      href={`/dashboard/messages?entry=${entryId}`}
      data-message-designer
      className={cx(
        "inline-flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#8B0000,#B3261E_45%,#D9A52B)] font-bold text-white transition-[filter] hover:brightness-110",
        size === "lg" ? "min-h-11 px-5" : "min-h-9 px-3 text-[13px]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className={size === "lg" ? "size-4" : "size-3.5"} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.7A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}

import Link from "next/link";

/**
 * Shown on every page while the account is suspended (owner, 2026-10-12): until when, what is on hold, and the rules.
 * A suspension lasts 48 hours and ends on its own.
 */
export function SuspendedBar({ text, rulesLabel }: { text: string; rulesLabel: string }) {
  return (
    <div role="status" className="relative z-40 bg-[#FFEDD5] px-4 py-2.5 text-center text-sm font-medium leading-snug text-[#7A3A0C]">
      {text}{" "}
      <Link href="/legal/designer-rules#suspensions" className="font-bold underline underline-offset-2">
        {rulesLabel}
      </Link>
    </div>
  );
}

import Link from "next/link";

/** "← Back" as a white pill with a tinted arrow, above an inner page's first panel (site design, owner 2026-10-10). */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex min-h-12 w-fit items-center gap-2.5 rounded-full bg-surface py-1 pl-1 pr-5 text-[15px] font-bold text-ink transition-colors hover:text-primary">
      <span className="flex size-10 items-center justify-center rounded-full bg-tint text-primary transition-transform duration-300 group-hover:-translate-x-0.5">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      </span>
      {children}
    </Link>
  );
}

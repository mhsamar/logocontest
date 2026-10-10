import Link from "next/link";

/** Section heading from the design: an icon badge or a pill, the title with its red accent, an optional line. */
export function SectionHead({ icon, pill, lead, accent, sub }: { icon?: React.ReactNode; pill?: string; lead: string; accent: string; sub?: string }) {
  return (
    <div className="lc-rv flex flex-col items-center gap-3.5 text-center">
      {icon && <span className="lc-g flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[image:var(--lc-grad-icon)]">{icon}</span>}
      {pill && <span className="rounded-full bg-[var(--lc-tint)] px-3.5 py-1.5 text-sm font-bold text-[var(--lc-red)]">{pill}</span>}
      <h2 className="m-0 text-[clamp(32px,4.2vw,54px)] font-semibold leading-[1.05] tracking-[-0.04em]">
        {lead} <span className="text-[var(--lc-red)]">{accent}</span>
      </h2>
      {sub && <p className="m-0 text-[19px] text-[var(--lc-muted)]">{sub}</p>}
    </div>
  );
}

/** The red gradient call-to-action button from the design. */
export function RedButton({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={`lc-g inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-[image:var(--lc-grad)] px-7 font-bold text-white ${className}`}>
      {children}
    </Link>
  );
}

export const Arrow = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

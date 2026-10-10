/**
 * Section heading from the site design (owner, 2026-10-10; UI-JOURNEY §1): an icon badge or a small
 * pill, the title with its last words in red, and an optional line under it.
 */
export function SectionHead({ icon, pill, lead, accent, sub, className = "" }: { icon?: React.ReactNode; pill?: string; lead: string; accent: string; sub?: string; className?: string }) {
  return (
    <div className={`lc-rv flex flex-col items-center gap-3.5 text-center ${className}`}>
      {icon && <IconBadge>{icon}</IconBadge>}
      {pill && <Pill>{pill}</Pill>}
      <h2 className="m-0 text-[clamp(32px,4.2vw,54px)] font-semibold leading-[1.05] tracking-[-0.04em]">
        {lead} <span className="text-primary">{accent}</span>
      </h2>
      {sub && <p className="m-0 text-[19px] text-muted">{sub}</p>}
    </div>
  );
}

/** Page title for inner pages: same heading style, a little smaller, left or centred. */
export function PageTitle({ lead, accent, sub, pill, center = false, className = "" }: { lead: string; accent?: string; sub?: string; pill?: string; center?: boolean; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${center ? "items-center text-center" : "items-start"} ${className}`}>
      {pill && <Pill>{pill}</Pill>}
      <h1 className="m-0 text-[clamp(30px,4vw,48px)] font-semibold leading-[1.05] tracking-[-0.04em]">
        {lead}
        {accent && <> <span className="text-primary">{accent}</span></>}
      </h1>
      {sub && <p className="m-0 max-w-2xl text-lg text-muted">{sub}</p>}
    </div>
  );
}

/** The red gradient square with a white icon. `dark` uses the deep red gradient. */
export function IconBadge({ children, dark = false, size = "md" }: { children: React.ReactNode; dark?: boolean; size?: "md" | "lg" | "xl" }) {
  const box = size === "xl" ? "h-16 w-16 rounded-[20px]" : size === "lg" ? "h-[60px] w-[60px] rounded-[18px]" : "h-[52px] w-[52px] rounded-2xl";
  return <span className={`lc-g flex shrink-0 items-center justify-center ${box} ${dark ? "bg-[image:var(--gradient-red-dark)]" : "bg-[image:var(--gradient-red-icon)]"}`}>{children}</span>;
}

/** Small red-tinted label above a heading ("Q&A", "Why logocontest.bd"). */
export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-tint px-3.5 py-1.5 text-sm font-bold text-primary">{children}</span>;
}

export const Arrow = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

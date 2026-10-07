export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
      <circle cx="15" cy="16" r="7.5" fill="var(--color-accent)" />
      <path d="M10 22.5h12.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-[1.0625rem] font-bold tracking-tight text-ink">
      <LogoMark />
      <span>
        logocontest<span className="text-primary">.bd</span>
      </span>
    </span>
  );
}

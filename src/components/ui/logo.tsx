export function LogoMark({ className = "size-8", inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill={inverted ? "var(--color-primary)" : "var(--color-ink)"} />
      <circle cx="16" cy="14.5" r="7" fill="var(--color-cream)" />
      <path d="M9.5 23.5h13" stroke={inverted ? "var(--color-cream)" : "var(--color-primary)"} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={`flex items-center gap-2 text-[1.0625rem] font-bold tracking-tight ${inverted ? "text-white" : "text-ink"}`}>
      <LogoMark inverted={inverted} />
      <span>
        logocontest<span className={inverted ? "text-cream" : "text-primary"}>.bd</span>
      </span>
    </span>
  );
}

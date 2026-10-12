/* eslint-disable @next/next/no-img-element -- signed, short-lived storage links */

/** Small pieces shared by the Design Studio hero, cards and previews (owner, 2026-10-12; Design/design-studio). */

/** The designer's photo, else the first letter of the @username. Never a link to the profile (owner's decision). */
export function StudioAvatar({ username, url, size = 32 }: { username: string | null; url: string | null; size?: number }) {
  return (
    <span className="ds-av" style={size !== 32 ? { width: size, height: size, fontSize: Math.round(size * 0.42) } : undefined} aria-hidden>
      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : (username?.[0] ?? "•").toUpperCase()}
    </span>
  );
}

export function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
    </svg>
  );
}

export function FilesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="7" y="7" width="13" height="13" rx="2" />
      <path d="M4 16V5a1 1 0 0 1 1-1h11" />
    </svg>
  );
}

export function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/** Winner (gold, trophy) or New (maroon, sent in the last 24 hours). */
export function StudioBadge({ winner, isNew, labels, still = false }: { winner: boolean; isNew: boolean; labels: { winner: string; new: string }; still?: boolean }) {
  if (winner)
    return (
      <span className={still ? "ds-wb st" : "ds-wb"}>
        <TrophyIcon />
        {labels.winner}
      </span>
    );
  if (isNew)
    return (
      <span className={still ? "ds-nb st" : "ds-nb"}>
        <i aria-hidden />
        {labels.new}
      </span>
    );
  return null;
}

/** One segment per file; the current one (and those before it) light up. */
export function Segments({ count, current, big = false }: { count: number; current: number; big?: boolean }) {
  if (count <= 1) return null;
  return (
    <span className={big ? "ds-sgs big" : "ds-sgs"} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className="ds-sg" data-on={i <= current ? "" : undefined} />
      ))}
    </span>
  );
}

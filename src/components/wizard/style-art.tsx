import type { LogoStyle } from "@/lib/contests/brief";

/**
 * Examples for the C-04 style tiles (UI-JOURNEY C-04, owner 2026-10-08): two small drawings per style. They are our
 * own simple artwork (owner, 2026-10-15: no other companies' logos anywhere on the site).
 */
const P = "var(--color-primary)";
const A = "var(--color-accent)";
const I = "var(--color-ink)";
const SANS = "Inter, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

function Art({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 64 48" className="h-12 w-16" aria-hidden>
      {children}
    </svg>
  );
}

const DRAWN: Record<LogoStyle, [React.ReactNode, React.ReactNode]> = {
  // A name written in a distinctive way.
  wordmark: [
    <text key="a" x="32" y="30" textAnchor="middle" fontSize="15" fontWeight="800" letterSpacing="-0.6" fill={P} fontFamily={SANS}>
      nodi
    </text>,
    <g key="b">
      <text x="32" y="28" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="1.6" fill={I} fontFamily={SANS}>
        SHAPLA
      </text>
      <rect x="14" y="32" width="36" height="2.2" rx="1.1" fill={A} />
    </g>,
  ],
  // A simple picture of a thing.
  pictorial: [
    <g key="a">
      <path d="M32 8C46 15 47 31 32 41C17 31 18 15 32 8Z" fill={P} />
      <path d="M32 14V38M32 22l6-4M32 29l-6-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </g>,
    <g key="b">
      <path d="M14 30c6-10 14-12 22-8 4-6 10-7 14-4-3 1-5 3-6 6 2 7-5 13-14 12-7-1-13-3-16-6Z" fill={I} />
      <circle cx="44" cy="22" r="1.4" fill="#fff" />
      <path d="M30 30l6 6" stroke={A} strokeWidth="2.2" strokeLinecap="round" />
    </g>,
  ],
  // Initials only.
  lettermark: [
    <g key="a">
      <rect x="16" y="8" width="32" height="32" rx="8" fill={P} />
      <text x="32" y="30" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily={SANS}>
        NK
      </text>
    </g>,
    <g key="b">
      <text x="32" y="33" textAnchor="middle" fontSize="22" fontWeight="900" letterSpacing="-1.5" fill={I} fontFamily={SANS}>
        gb
      </text>
      <circle cx="47" cy="31" r="2.4" fill={A} />
    </g>,
  ],
  // Hand-written letters.
  calligraphy: [
    <text key="a" x="32" y="31" textAnchor="middle" fontSize="17" fontStyle="italic" fill={P} fontFamily={SERIF}>
      Rupa
    </text>,
    <g key="b">
      <text x="32" y="29" textAnchor="middle" fontSize="18" fontStyle="italic" fontWeight="700" fill={I} fontFamily={SERIF}>
        Padma
      </text>
      <path d="M14 34c10 4 26 4 36-1" stroke={A} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </g>,
  ],
  // A friendly character.
  mascot: [
    <g key="a">
      <path d="M20 14l5 7M44 14l-5 7" stroke={I} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="27" r="13" fill={A} />
      <circle cx="27" cy="25" r="2" fill={I} />
      <circle cx="37" cy="25" r="2" fill={I} />
      <path d="M28 31q4 3 8 0" stroke={I} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </g>,
    <g key="b">
      <rect x="19" y="12" width="26" height="22" rx="7" fill={P} />
      <circle cx="27" cy="23" r="3" fill="#fff" />
      <circle cx="37" cy="23" r="3" fill="#fff" />
      <path d="M32 12V7M24 34v5M40 34v5" stroke={I} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="32" cy="6" r="2" fill={A} />
    </g>,
  ],
  abstract: [
    <g key="a" fillOpacity="0.85">
      <circle cx="26" cy="20" r="10" fill={P} />
      <circle cx="38" cy="20" r="10" fill={A} />
      <circle cx="32" cy="30" r="10" fill={I} />
    </g>,
    <g key="b">
      <path d="M16 38L32 10l16 28Z" fill={P} />
      <path d="M22 38a10 10 0 0 1 20 0" fill={A} />
    </g>,
  ],
  emblem: [
    <g key="a">
      <circle cx="32" cy="24" r="18" fill={I} />
      <circle cx="32" cy="24" r="13" fill="none" stroke={A} strokeWidth="1.5" strokeDasharray="2 2" />
      <path d="M32 16l2.4 5 5.4.6-4 3.7 1.1 5.3L32 28l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6Z" fill={A} />
    </g>,
    <g key="b">
      <path d="M32 6l14 5v12c0 9-6 16-14 19-8-3-14-10-14-19V11Z" fill={P} />
      <text x="32" y="29" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="Inter, sans-serif">
        S
      </text>
    </g>,
  ],
};

export function StyleExamples({ style }: { style: LogoStyle }) {
  const [a, b] = DRAWN[style];
  return (
    <span className="flex items-center justify-center gap-1">
      <Art>{a}</Art>
      <Art>{b}</Art>
    </span>
  );
}

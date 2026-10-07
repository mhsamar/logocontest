import type { LogoStyle } from "@/lib/contests/brief";

/**
 * Example shapes for the C-04 style tiles. Our own simple drawings — never real
 * brand logos (UI-JOURNEY C-04).
 */
const P = "var(--color-primary)";
const A = "var(--color-accent)";
const I = "var(--color-ink)";

function Art({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 64 48" className="h-12 w-16" aria-hidden>
      {children}
    </svg>
  );
}

const EXAMPLES: Record<LogoStyle, [React.ReactNode, React.ReactNode]> = {
  wordmark: [
    <text key="a" x="32" y="30" textAnchor="middle" fontSize="15" fontWeight="800" fill={I} fontFamily="Inter, sans-serif">
      Rahim
    </text>,
    <text key="b" x="32" y="31" textAnchor="middle" fontSize="17" fontStyle="italic" fill={P} fontFamily="Georgia, serif">
      nodi
    </text>,
  ],
  lettermark: [
    <g key="a">
      <rect x="16" y="8" width="32" height="32" rx="6" fill={I} />
      <text x="32" y="30" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="Inter, sans-serif">
        RT
      </text>
    </g>,
    <g key="b">
      <circle cx="32" cy="24" r="16" fill="none" stroke={P} strokeWidth="3" />
      <text x="32" y="31" textAnchor="middle" fontSize="20" fontWeight="700" fill={P} fontFamily="Georgia, serif">
        B
      </text>
    </g>,
  ],
  pictorial: [
    <path key="a" d="M18 36C18 20 30 10 46 10c0 16-10 26-26 26Zm2-2L40 16" fill={P} stroke="#fff" strokeWidth="1.5" />,
    <g key="b">
      <path d="M12 28c8-10 26-12 38-2-12 10-30 8-38 2Z" fill={A} />
      <path d="M50 26l6-6v12Z" fill={A} />
      <circle cx="22" cy="25" r="2" fill={I} />
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
  mascot: [
    <g key="a">
      <path d="M18 14l6 8M46 14l-6 8" stroke={A} strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="27" r="14" fill={A} />
      <circle cx="27" cy="25" r="2" fill={I} />
      <circle cx="37" cy="25" r="2" fill={I} />
      <path d="M27 31q5 4 10 0" stroke={I} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>,
    <g key="b">
      <circle cx="30" cy="25" r="14" fill={P} />
      <path d="M43 23l10 3-10 3Z" fill={A} />
      <circle cx="34" cy="21" r="3" fill="#fff" />
      <circle cx="35" cy="21" r="1.5" fill={I} />
    </g>,
  ],
  calligraphy: [
    <text key="a" x="32" y="32" textAnchor="middle" fontSize="20" fontWeight="700" fill={P} fontFamily="'Hind Siliguri', sans-serif">
      নদী
    </text>,
    <text key="b" x="32" y="32" textAnchor="middle" fontSize="22" fill={I} fontFamily="serif">
      نور
    </text>,
  ],
};

export function StyleExamples({ style }: { style: LogoStyle }) {
  const [a, b] = EXAMPLES[style];
  return (
    <span className="flex items-center justify-center gap-1">
      <Art>{a}</Art>
      <Art>{b}</Art>
    </span>
  );
}

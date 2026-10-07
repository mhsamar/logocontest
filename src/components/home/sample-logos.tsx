/**
 * Six sample logos for the example contest on the home page. Our own drawings
 * for a made-up brand ("Nodi Tea House") — not real designers' work.
 */
const R = "var(--color-primary)";
const M = "var(--color-primary-dark)";
const G = "var(--color-accent)";
const C = "var(--color-cream)";
const K = "var(--color-ink)";

function Frame({ children, bg = "#fff" }: { children: React.ReactNode; bg?: string }) {
  return (
    <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden>
      <rect width="120" height="90" fill={bg} />
      {children}
    </svg>
  );
}

export const SAMPLE_LOGOS: React.ReactNode[] = [
  // 1. Emblem: cup in a ring
  <Frame key="1" bg={C}>
    <circle cx="60" cy="40" r="24" fill="none" stroke={M} strokeWidth="2.5" />
    <circle cx="60" cy="40" r="19" fill="none" stroke={M} strokeWidth="1" strokeDasharray="2 2.5" />
    <path d="M49 34h20v9a10 10 0 0 1-20 0Z" fill={R} />
    <path d="M69 37h3a4 4 0 0 1 0 8h-3" fill="none" stroke={R} strokeWidth="2" />
    <path d="M55 27q2-3 0-6M61 27q2-3 0-6" stroke={M} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <text x="60" y="78" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="2" fill={K} fontFamily="Inter, sans-serif">
      NODI TEA
    </text>
  </Frame>,
  // 2. Monogram
  <Frame key="2">
    <rect x="42" y="18" width="36" height="36" rx="9" fill={K} />
    <text x="60" y="43" textAnchor="middle" fontSize="17" fontWeight="800" fill={C} fontFamily="Inter, sans-serif">
      NT
    </text>
    <text x="60" y="74" textAnchor="middle" fontSize="8.5" fontWeight="600" letterSpacing="1.5" fill={K} fontFamily="Inter, sans-serif">
      NODI TEA HOUSE
    </text>
  </Frame>,
  // 3. Leaf + wordmark
  <Frame key="3">
    <path d="M20 58C20 38 34 26 52 26c0 20-12 32-32 32Zm3-3 24-24" fill={R} stroke="#fff" strokeWidth="1.6" />
    <text x="57" y="48" fontSize="15" fontWeight="800" fill={K} fontFamily="Inter, sans-serif">
      nodi
    </text>
    <text x="57" y="60" fontSize="7" letterSpacing="1" fill={G} fontFamily="Inter, sans-serif">
      TEA HOUSE
    </text>
  </Frame>,
  // 4. Bangla calligraphy
  <Frame key="4" bg={K}>
    <text x="60" y="52" textAnchor="middle" fontSize="30" fontWeight="700" fill={C} fontFamily="'Hind Siliguri', sans-serif">
      নদী
    </text>
    <path d="M36 62q24 8 48 0" stroke={R} strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </Frame>,
  // 5. Abstract waves
  <Frame key="5">
    <path d="M28 44q8-10 16 0t16 0 16 0 16 0" stroke={R} strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M28 54q8-10 16 0t16 0 16 0 16 0" stroke={G} strokeWidth="4" fill="none" strokeLinecap="round" />
    <text x="60" y="76" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="2" fill={K} fontFamily="Inter, sans-serif">
      NODI
    </text>
  </Frame>,
  // 6. Mascot bird with cup
  <Frame key="6" bg={C}>
    <circle cx="56" cy="40" r="17" fill={M} />
    <path d="M72 38l11 4-11 4Z" fill={G} />
    <circle cx="61" cy="35" r="3.5" fill="#fff" />
    <circle cx="62" cy="35" r="1.7" fill={K} />
    <text x="60" y="76" textAnchor="middle" fontSize="9" fontWeight="700" fill={K} fontFamily="Inter, sans-serif">
      Nodi Tea
    </text>
  </Frame>,
];

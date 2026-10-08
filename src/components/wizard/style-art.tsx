import type { LogoStyle } from "@/lib/contests/brief";

/**
 * Examples for the C-04 style tiles (UI-JOURNEY C-04, owner 2026-10-08): well-known
 * brand logos from Wikimedia Commons in public/style-examples/, shown only to explain
 * each style. Abstract and Emblem have no free files, so they keep our own drawings.
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

/** A downloaded brand logo, fitted into the same slot as a drawing. */
function Logo({ file }: { file: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/style-examples/${file}.svg`} alt="" className="h-12 w-16 object-contain p-1" loading="lazy" />;
}

const BRANDS: Partial<Record<LogoStyle, [string, string]>> = {
  wordmark: ["facebook", "yahoo"],
  pictorial: ["apple", "nbc"],
  lettermark: ["f1", "mcdonalds"],
  calligraphy: ["rayban", "cocacola"],
  mascot: ["kfc", "tux"],
};

const DRAWN: Partial<Record<LogoStyle, [React.ReactNode, React.ReactNode]>> = {
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
  const brands = BRANDS[style];
  if (brands) {
    return (
      <span className="flex items-center justify-center gap-1">
        <Logo file={brands[0]} />
        <Logo file={brands[1]} />
      </span>
    );
  }
  const [a, b] = DRAWN[style]!;
  return (
    <span className="flex items-center justify-center gap-1">
      <Art>{a}</Art>
      <Art>{b}</Art>
    </span>
  );
}

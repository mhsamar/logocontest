import type { UsedOn } from "@/lib/contests/brief";

/** Small line icons for "Where the logo will be used" (P-03, owner 2026-10-08). */
const PATHS: Record<UsedOn, React.ReactNode> = {
  social: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M12 15.5s-3-1.8-3-4a1.7 1.7 0 0 1 3-1.1 1.7 1.7 0 0 1 3 1.1c0 2.2-3 4-3 4Z" />
    </>
  ),
  website: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M2.5 8.5h19M6 6.3h.01M8.5 6.3h.01" />
    </>
  ),
  signboard: (
    <>
      <rect x="3" y="4" width="18" height="10" rx="1.5" />
      <path d="M7 14v6M17 14v6M7 9h10" />
    </>
  ),
  packaging: (
    <>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </>
  ),
  print: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M6.5 10h5M6.5 13.5h8" />
      <circle cx="17" cy="10.5" r="1.5" />
    </>
  ),
  merchandise: <path d="M8 3.5 3.5 6.5 5.5 10l2-1v11.5h9V9l2 1 2-3.5L16 3.5c-.6 1.5-2.1 2.5-4 2.5S8.6 5 8 3.5Z" />,
  video: (
    <>
      <rect x="2.5" y="5" width="19" height="13" rx="2" />
      <path d="M10 9v5l4.5-2.5Z" />
      <path d="M8 21h8" />
    </>
  ),
};

export function UsedOnIcon({ kind }: { kind: UsedOn }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[kind]}
    </svg>
  );
}

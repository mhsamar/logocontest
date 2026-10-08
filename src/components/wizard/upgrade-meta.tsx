import type { UpgradeKey } from "@/lib/contests/brief";

/** Icon and colour for each add-on (C-08, client home P-01c). Shared by server and client components. */
export const UPGRADE_ICONS: Record<UpgradeKey, React.ReactNode> = {
  promoted: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />,
  blind: <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7a10 10 0 0 1-2.4 3.4M6.6 6.6C4.3 8 3 10.4 3 12c0 2 4 7 9 7a9.7 9.7 0 0 0 4.1-.9" />,
  private: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  logo_scan: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.3-4.3M3 7V4a1 1 0 0 1 1-1h3M21 7V4a1 1 0 0 0-1-1h-3" />
    </>
  ),
  highlight: <path d="M12 2l2.2 6.8H21l-5.5 4 2.1 6.7L12 15.4l-5.6 4.1 2.1-6.7L3 8.8h6.8ZM19 2v3M17.5 3.5h3" />,
  urgent: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
  nda: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
};

export const UPGRADE_TINT: Record<UpgradeKey, string> = {
  promoted: "from-[#fff7e0] to-[#ffe6a8] text-[#8a5105]",
  blind: "from-[#eef2f7] to-[#dde3ec] text-ink",
  private: "from-[#f1ecff] to-[#e2d6ff] text-[#5b21b6]",
  logo_scan: "from-[#e7f8f0] to-[#c9efdc] text-[#0f6b45]",
  highlight: "from-[#fff4d1] to-[#ffdf8a] text-[#8a5105]",
  urgent: "from-[#ffe9e9] to-[#ffd0d0] text-danger",
  nda: "from-[#e8f1ff] to-[#d4e4ff] text-[#1d4ed8]",
};


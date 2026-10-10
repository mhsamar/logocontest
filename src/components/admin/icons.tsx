/** Line icons of the admin design (design/admin/*.html), 24×24, stroked with the current colour. */
const PATHS = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="8" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="2" />
      <rect x="13.5" y="12.5" width="7" height="8" rx="2" />
      <rect x="3.5" y="15.5" width="7" height="5" rx="2" />
    </>
  ),
  live: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M6 6a8.5 8.5 0 0 0 0 12M18 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  analytics: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  tickets: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M14 6v12" />
    </>
  ),
  contests: <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4c0 3 1.5 4.5 3.5 4.5M17 6h3c0 3-1.5 4.5-3.5 4.5M12 14v4M8.5 20h7" />,
  designs: (
    <>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
      <path d="M14 7l3 3" />
    </>
  ),
  reports: <path d="M5 21V4h11l-1.5 4L16 12H5" />,
  claims: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
    </>
  ),
  checker: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  unpaid: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  monthly: <path d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5L12 16.3 7 19l1.1-5.5L4 9.7 9.6 9z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.5 14.2A5 5 0 0 1 21 19" />
    </>
  ),
  agreements: (
    <>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M10 12h6M10 16h4" />
    </>
  ),
  team: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />,
  payments: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10.5h18M7 15h3" />
    </>
  ),
  withdrawals: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" />,
  support: (
    <>
      <path d="M4 13l2-8h12l2 8v6H4z" />
      <path d="M4 13h5a3 3 0 0 0 6 0h5" />
    </>
  ),
  send: <path d="M20 4L3 11l7 3 3 7z" />,
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8" />
    </>
  ),
  texts: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  lists: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  legal: <path d="M12 4v16M6 20h12M5 8l7-3 7 3M5 8l-2 6a3 3 0 0 0 4 0zM19 8l-2 6a3 3 0 0 0 4 0z" />,
  brand: <path d="M4 10v4h3l6 4V6l-6 4zM17 9a4 4 0 0 1 0 6" />,
  homepage: (
    <>
      <path d="M4 11l8-7 8 7v9H4z" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  blocked: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.7 5.7l12.6 12.6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  audit: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  // Top bar, menus and tiles
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  external: <path d="M7 17L17 7M9 7h8v8" />,
  bell: <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4" />,
  messages: (
    <>
      <path d="M4 5h13v9H9l-5 4z" />
      <path d="M17 9h3v9l-3-2h-6" />
    </>
  ),
  chevron: <path d="M9 5l7 7-7 7" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  revenue: <path d="M4 17l5-5 4 3 7-8M15 7h5v5" />,
  joined: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
    </>
  ),
  comment: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />,
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />,
} as const;

export type AdminIconName = keyof typeof PATHS;

export function AdminIcon({ name, size = 18, className }: { name: AdminIconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {PATHS[name]}
    </svg>
  );
}

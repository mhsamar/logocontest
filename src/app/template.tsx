/** Each page fades and rises in on navigation; header and footer stay put (UI-JOURNEY §1.5). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in flex flex-1 animate-page-in flex-col">{children}</div>;
}

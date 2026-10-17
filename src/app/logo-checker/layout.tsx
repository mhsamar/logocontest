import { ClientArea } from "@/components/client/client-area";

// A signed-in client sees these pages inside the client workspace (owner, 2026-10-17: the right-side menu on every page).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClientArea>{children}</ClientArea>;
}

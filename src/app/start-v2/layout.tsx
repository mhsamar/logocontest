import { ClientArea } from "@/components/client/client-area";

// Like /start: a signed-in client sees onboarding v2 inside the client workspace (owner, 2026-10-28).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClientArea>{children}</ClientArea>;
}

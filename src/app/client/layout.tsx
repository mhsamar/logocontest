import type { Metadata } from "next";
import { ClientArea } from "@/components/client/client-area";

// The client workspace can be added to a phone's Home Screen (owner, 2026-10-22): iPhones show its notifications
// only then.
export const metadata: Metadata = { manifest: "/client-app.webmanifest" };

// A signed-in client sees these pages inside the client workspace (owner, 2026-10-17).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClientArea>{children}</ClientArea>;
}

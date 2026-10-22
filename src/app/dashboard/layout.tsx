import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";

// The dashboard can be added to a phone's Home Screen (owner, 2026-10-22): iPhones show its notifications only then.
// Clients reach a few pages under /dashboard (prize claim, brief editing) and get the client workspace's app.
export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  return { manifest: user?.role === "client" ? "/client-app.webmanifest" : "/designer-app.webmanifest" };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}

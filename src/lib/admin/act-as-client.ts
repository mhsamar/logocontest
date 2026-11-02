import "server-only";
import { audit } from "@/lib/admin/core";

/**
 * A Super admin doing the client's work on the client's contest page (owner, 2026-11-02: "admin dea exactly client er
 * sokol kaz koray deya jabay"): rating, shortlist, rejecting a design, picking the winner, approving the files or
 * asking for changes. It is done in the client's name (the client's id goes to the database, as if they clicked),
 * and every action is written to the audit log with the admin who did it.
 */
export type ActingUser = { id: string; isSuperAdmin?: boolean; role: string; status: string };

/** Who may act for this contest's client: the client, or a Super admin (then `adminId` is set). */
export function actorFor(user: ActingUser | null, clientId: string): { clientId: string; adminId: string | null } | null {
  if (!user || user.status === "banned") return null;
  if (user.role === "client" && user.id === clientId) return { clientId, adminId: null };
  if (user.isSuperAdmin) return { clientId, adminId: user.id };
  return null;
}

/** The audit row for an action a Super admin did for the client. */
export async function logActAsClient(adminId: string | null, action: string, contestId: string, details: Record<string, unknown> = {}): Promise<void> {
  if (adminId) await audit(adminId, "act_as_client", "contest", contestId, { action, ...details });
}

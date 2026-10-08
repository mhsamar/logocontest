/**
 * Who sees which designs and who may comment on them (UI-JOURNEY P-03, BLUEPRINT §7.4, §10).
 * Pure functions, so the rules are easy to test.
 */

export type EntryStatus = "active" | "rejected" | "withdrawn" | "removed" | "winner" | "forfeited";

/** Statuses everyone who can see the contest's entries sees. */
export const SHOWN_STATUSES: EntryStatus[] = ["active", "winner", "forfeited"];

export type EntryViewer = { id: string; role: "client" | "designer" | "admin" } | null;

export type ContestForEntries = {
  ownerId: string;
  isBlind: boolean;
  canSeeBrief: boolean;
  status: string;
  winnerIsPublic: boolean;
};

export type EntryScope =
  /** Every design, including rejected ones (the contest's client and admins). */
  | { kind: "all" }
  /** Active and winning designs, plus the viewer's own in any visible state. */
  | { kind: "public"; ownerDesignerId: string | null }
  /** Blind contest: only the viewer's own designs, plus the winner once the client made it public. */
  | { kind: "own"; designerId: string | null; winnerOnly: boolean }
  | { kind: "none" };

export function entryScope(contest: ContestForEntries, viewer: EntryViewer): EntryScope {
  if (!contest.canSeeBrief) return { kind: "none" };
  if (viewer && (viewer.id === contest.ownerId || viewer.role === "admin")) return { kind: "all" };
  if (!contest.isBlind) return { kind: "public", ownerDesignerId: viewer?.role === "designer" ? viewer.id : null };
  const winnerOnly = contest.status === "completed" && contest.winnerIsPublic;
  if (viewer?.role === "designer") return { kind: "own", designerId: viewer.id, winnerOnly };
  return winnerOnly ? { kind: "own", designerId: null, winnerOnly } : { kind: "none" };
}

/** Whether this viewer sees one design with this status and designer. */
export function canSeeEntry(scope: EntryScope, entry: { status: EntryStatus; designerId: string }): boolean {
  switch (scope.kind) {
    case "all":
      return entry.status !== "removed";
    case "public":
      if (entry.designerId === scope.ownerDesignerId) return entry.status !== "removed";
      return SHOWN_STATUSES.includes(entry.status);
    case "own":
      if (scope.designerId && entry.designerId === scope.designerId) return entry.status !== "removed";
      return scope.winnerOnly && entry.status === "winner";
    case "none":
      return false;
  }
}

/** Designer names are hidden in blind contests from everyone except the client, admins and the designer. */
export function showDesignerName(contest: ContestForEntries, viewer: EntryViewer, entryDesignerId: string): boolean {
  if (!contest.isBlind) return true;
  return Boolean(viewer && (viewer.id === contest.ownerId || viewer.role === "admin" || viewer.id === entryDesignerId));
}

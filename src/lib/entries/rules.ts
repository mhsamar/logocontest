/**
 * Who sees which designs and who may comment on them (UI-JOURNEY P-03, BLUEPRINT §7.4, §10).
 * Pure functions, so the rules are easy to test.
 */

import { PUBLIC_STATUSES } from "@/lib/contests/public-statuses";

/** "held" (owner, 2026-10-15; migration 0061): the design check thinks it isn't a design; it waits for Admin › Designs. */
export type EntryStatus = "active" | "rejected" | "withdrawn" | "removed" | "winner" | "forfeited" | "held";

/** Statuses everyone who can see the contest's entries sees. */
export const SHOWN_STATUSES: EntryStatus[] = ["active", "winner", "forfeited"];

/**
 * Designs nobody sees on the site (only admins): removed by an admin, or withdrawn by their own designer
 * (owner, 2026-10-11).
 */
export const GONE_STATUSES: EntryStatus[] = ["removed", "withdrawn"];

/** The hold reason of a design that waits only because every design waits for approval (owner, 2026-10-20). */
export const APPROVE_ALL_REASON = "approve_all";

/** Designs their designer may still take back, whole or picture by picture, while the contest is open. */
export const WITHDRAWABLE: EntryStatus[] = ["active", "rejected", "held"];

export type EntryViewer = { id: string; role: "client" | "designer" | "admin" } | null;

export type ContestForEntries = {
  ownerId: string;
  isBlind: boolean;
  canSeeBrief: boolean;
  status: string;
  winnerIsPublic: boolean;
};

export type EntryScope =
  /** Every design, including rejected ones (the contest's client and admins; only admins see held ones). */
  | { kind: "all"; admin?: boolean }
  /** Active and winning designs, plus the viewer's own in any visible state. */
  | { kind: "public"; ownerDesignerId: string | null }
  /** Blind contest: only the viewer's own designs, plus the winner once the client made it public. */
  | { kind: "own"; designerId: string | null; winnerOnly: boolean }
  | { kind: "none" };

export function entryScope(contest: ContestForEntries, viewer: EntryViewer): EntryScope {
  if (!contest.canSeeBrief) return { kind: "none" };
  // A cancelled contest (money back, or cancelled by the team): nobody was paid for its designs, so only the admin
  // team still sees them (owner, 2026-10-21).
  if (contest.status === "cancelled" && viewer?.role !== "admin") return { kind: "none" };
  if (viewer && (viewer.id === contest.ownerId || viewer.role === "admin")) return { kind: "all", admin: viewer.role === "admin" };
  if (!contest.isBlind) return { kind: "public", ownerDesignerId: viewer?.role === "designer" ? viewer.id : null };
  const winnerOnly = contest.status === "completed" && contest.winnerIsPublic;
  if (viewer?.role === "designer") return { kind: "own", designerId: viewer.id, winnerOnly };
  return winnerOnly ? { kind: "own", designerId: null, winnerOnly } : { kind: "none" };
}

/** Whether this viewer sees one design with this status and designer. */
export function canSeeEntry(scope: EntryScope, entry: { status: EntryStatus; designerId: string }): boolean {
  // A held design: only its own designer and the admin team, until it is approved (owner, 2026-10-15).
  if (entry.status === "held") {
    if (scope.kind === "all") return scope.admin === true;
    if (scope.kind === "public") return entry.designerId === scope.ownerDesignerId;
    if (scope.kind === "own") return Boolean(scope.designerId) && entry.designerId === scope.designerId;
    return false;
  }
  switch (scope.kind) {
    case "all":
      return !GONE_STATUSES.includes(entry.status);
    case "public":
      if (entry.designerId === scope.ownerDesignerId) return !GONE_STATUSES.includes(entry.status);
      return SHOWN_STATUSES.includes(entry.status);
    case "own":
      if (scope.designerId && entry.designerId === scope.designerId) return !GONE_STATUSES.includes(entry.status);
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

/**
 * Pro "Hide my design" (owner, 2026-10-14): a hidden design stays hidden while the contest is open or being judged;
 * once the winner is picked every design is public.
 */
export const HIDING_STATUSES = ["open", "judging"];
export const stillHidden = (isHidden: boolean | null | undefined, contestStatus: string) => Boolean(isHidden) && HIDING_STATUSES.includes(contestStatus);

/** Who sees the picture of a hidden design: the contest's client, admins and its designer. */
export function seesHiddenPicture(contest: { ownerId: string }, viewer: EntryViewer, designerId: string): boolean {
  return Boolean(viewer && (viewer.id === contest.ownerId || viewer.role === "admin" || viewer.id === designerId));
}

export type PublicDesignContest = { status: string; isPrivate: boolean; isBlind: boolean; winnerIsPublic: boolean };

/**
 * Whether anyone, logged out included, may see this design (designer profiles, Design Studio P-13):
 * a public, non-private contest; active, winning or forfeited designs; in blind contests only the
 * winner, once the contest is completed and the client made it public.
 */
export function isPublicDesign(entry: { status: EntryStatus; isHidden?: boolean | null }, contest: PublicDesignContest): boolean {
  if (!SHOWN_STATUSES.includes(entry.status) || !(PUBLIC_STATUSES as readonly string[]).includes(contest.status) || contest.isPrivate) return false;
  // A Pro designer's hidden design (owner, 2026-10-14) is public only once the winner is picked.
  if (stillHidden(entry.isHidden, contest.status)) return false;
  if (!contest.isBlind) return true;
  return entry.status === "winner" && contest.status === "completed" && contest.winnerIsPublic;
}

/**
 * Share buttons and the design's public page (owner, 2026-10-18): only designs a logged-out visitor already sees,
 * and never from an NDA contest. Everything else (private, blind, hidden, held, rejected) is never shared.
 */
export function isShareableDesign(entry: { status: EntryStatus; isHidden?: boolean | null }, contest: PublicDesignContest & { isNda: boolean }): boolean {
  return !contest.isNda && isPublicDesign(entry, contest);
}

/**
 * A designer may remove (withdraw) their own design while the contest still takes designs (owner, 2026-10-11:
 * uploaded by mistake, or they think it isn't good). A rejected design can go too; a winner never.
 * The same rule lets them remove single pictures (owner, 2026-10-16), also from a design waiting for approval.
 * Once the contest stops taking designs, its designs stay: they are the designer's portfolio.
 */
export function canWithdraw(entry: { status: EntryStatus; designerId: string }, contest: { status: string; endsAt: Date | null }, viewerId: string | null | undefined, now = new Date()): boolean {
  if (!viewerId || entry.designerId !== viewerId) return false;
  if (!WITHDRAWABLE.includes(entry.status)) return false;
  return contest.status === "open" && (!contest.endsAt || contest.endsAt > now);
}

export type VoteViewer = { id: string; role: "client" | "designer" | "admin"; status: string } | null;

/**
 * Like and dislike on designs (owner, 2026-10-11): any designer on other designers' designs they can see,
 * never their own; a client only on designs in their own contest. Admins don't vote.
 */
export function canVote(viewer: VoteViewer, ctx: { contestOwnerId: string; entryDesignerId: string }): boolean {
  if (!viewer || viewer.status !== "active") return false;
  if (viewer.role === "client") return viewer.id === ctx.contestOwnerId;
  if (viewer.role === "designer") return viewer.id !== ctx.entryDesignerId;
  return false;
}

/** Ways to order the designs on a contest (owner, 2026-10-11). "top" (best rated first) is the default. */
export const ENTRY_SORTS = ["top", "liked", "disliked", "comments", "newest"] as const;
export type EntrySort = (typeof ENTRY_SORTS)[number];
export const isEntrySort = (v: unknown): v is EntrySort => (ENTRY_SORTS as readonly unknown[]).includes(v);

type Sortable = { number: number; status: EntryStatus; rating: number | null; upVotes: number; downVotes: number; commentCount: number };

/**
 * Best rated first by default, with the winner on top; the other orders sort by that count only.
 * Ties: stars, then likes, then the newest design.
 */
export function sortEntries<T extends Sortable>(list: readonly T[], sort: EntrySort): T[] {
  const key = (e: T): number => (sort === "liked" ? e.upVotes : sort === "disliked" ? e.downVotes : sort === "comments" ? e.commentCount : 0);
  return [...list].sort((a, b) => {
    if (sort === "newest") return b.number - a.number;
    if (sort === "top") {
      const w = Number(b.status === "winner") - Number(a.status === "winner");
      if (w) return w;
    }
    return key(b) - key(a) || (b.rating ?? 0) - (a.rating ?? 0) || b.upVotes - a.upVotes || b.number - a.number;
  });
}

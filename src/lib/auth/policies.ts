import { isActiveAdmin } from "@/lib/admin/permissions";

export type Role = "client" | "designer" | "admin";
export type UserStatus = "active" | "suspended" | "banned";

export type CurrentUser = {
  id: string;
  mobile: string;
  name: string;
  role: Role;
  status: UserStatus;
  locale: "en" | "bn";
  email: string | null;
  emailVerifiedAt: string | null;
  username: string | null;
  /** Public URL of the profile photo, if any. */
  avatarUrl: string | null;
  /** Admin panel 2.0 (BLUEPRINT §13.2): the owner's account, and what a staff admin may do. */
  isSuperAdmin: boolean;
  adminActive: boolean;
  adminPermissions: string[];
  adminTitle: string | null;
};

/**
 * Every authorization check goes through here. Add one entry per ability;
 * pages and actions call can()/authorize() instead of checking roles inline.
 */
/** What a check may need to know about the thing being acted on. */
export type PolicyContext = {
  contestOwnerId?: string;
  /** Design comments: whose design it is. */
  entryDesignerId?: string;
  /** Contest comments: whether the viewer submitted a design to this contest. */
  viewerHasEntry?: boolean;
};

const active = (user: CurrentUser | null): user is CurrentUser => user?.status === "active";

const POLICIES = {
  // Admins: the Super admin, or a staff admin who is switched on (BLUEPRINT §13.2).
  "admin.access": (user: CurrentUser | null) => isActiveAdmin(user),
  // Guests may start the wizard; signed-in users must be active clients (one account = one role).
  "contest.create": (user: CurrentUser | null) => user === null || (user.role === "client" && user.status === "active"),
  // Public contest comments: the contest's own client, or a designer who submitted to it
  // (BLUEPRINT §10; owner 2026-10-11: no longer any designer).
  "contest.comment": (user: CurrentUser | null, ctx?: PolicyContext) =>
    active(user) && ((user.role === "designer" && Boolean(ctx?.viewerHasEntry)) || (user.role === "client" && user.id === ctx?.contestOwnerId)),
  // Design comments (owner, 2026-10-11): the contest's client, or the design's own designer. Other designers
  // can't comment on someone else's design (they can like, dislike or report it).
  "entry.comment": (user: CurrentUser | null, ctx?: PolicyContext) =>
    active(user) && ((user.role === "client" && user.id === ctx?.contestOwnerId) || (user.role === "designer" && user.id === ctx?.entryDesignerId)),
  // Submitting designs: active designers only (the contest must also be open).
  "entry.submit": (user: CurrentUser | null) => active(user) && user.role === "designer",
  // Saved contests (heart) are for designers.
  "contest.save": (user: CurrentUser | null) => active(user) && user.role === "designer",
} satisfies Record<string, (user: CurrentUser | null, ctx?: PolicyContext) => boolean>;

export type Ability = keyof typeof POLICIES;

export function can(user: CurrentUser | null, ability: Ability, ctx?: PolicyContext): boolean {
  return POLICIES[ability](user, ctx);
}

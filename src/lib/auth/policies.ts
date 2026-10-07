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
};

/**
 * Every authorization check goes through here. Add one entry per ability;
 * pages and actions call can()/authorize() instead of checking roles inline.
 */
/** What a check may need to know about the thing being acted on. */
export type PolicyContext = { contestOwnerId?: string };

const active = (user: CurrentUser | null): user is CurrentUser => user?.status === "active";

const POLICIES = {
  "admin.access": (user: CurrentUser | null) => user?.role === "admin" && user.status === "active",
  // Guests may start the wizard; signed-in users must be active clients (one account = one role).
  "contest.create": (user: CurrentUser | null) => user === null || (user.role === "client" && user.status === "active"),
  // Public contest comments: the contest's own client, or any designer (BLUEPRINT §10, owner 2026-10-08).
  "contest.comment": (user: CurrentUser | null, ctx?: PolicyContext) =>
    active(user) && (user.role === "designer" || (user.role === "client" && user.id === ctx?.contestOwnerId)),
  // Saved contests (heart) are for designers.
  "contest.save": (user: CurrentUser | null) => active(user) && user.role === "designer",
} satisfies Record<string, (user: CurrentUser | null, ctx?: PolicyContext) => boolean>;

export type Ability = keyof typeof POLICIES;

export function can(user: CurrentUser | null, ability: Ability, ctx?: PolicyContext): boolean {
  return POLICIES[ability](user, ctx);
}

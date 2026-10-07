export type Role = "client" | "designer" | "admin";
export type UserStatus = "active" | "suspended" | "banned";

export type CurrentUser = {
  id: string;
  mobile: string;
  name: string;
  role: Role;
  status: UserStatus;
  locale: "en" | "bn";
};

/**
 * Every authorization check goes through here. Add one entry per ability;
 * pages and actions call can()/authorize() instead of checking roles inline.
 */
const POLICIES = {
  "admin.access": (user: CurrentUser | null) => user?.role === "admin" && user.status === "active",
  // Guests may start the wizard; signed-in users must be active clients (one account = one role).
  "contest.create": (user: CurrentUser | null) => user === null || (user.role === "client" && user.status === "active"),
} satisfies Record<string, (user: CurrentUser | null) => boolean>;

export type Ability = keyof typeof POLICIES;

export function can(user: CurrentUser | null, ability: Ability): boolean {
  return POLICIES[ability](user);
}

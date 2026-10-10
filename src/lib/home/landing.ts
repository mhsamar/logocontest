/** Who sees the designed home page (owner, 2026-10-10): guests and admins. Clients and designers have their own homes. */
export const showsLanding = (role: string | null | undefined): boolean => !role || role === "admin";

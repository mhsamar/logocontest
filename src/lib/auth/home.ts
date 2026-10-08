/** Where each role lands after logging in (owner, 2026-10-08; UI-JOURNEY P-11). */
export function homeForRole(role: string | null | undefined): string {
  return role === "client" ? "/dashboard" : role === "designer" ? "/contests" : role === "admin" ? "/admin" : "/";
}

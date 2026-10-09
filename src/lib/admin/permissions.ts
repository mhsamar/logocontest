/**
 * Staff permissions (owner, 2026-10-09; BLUEPRINT §13.2 item 2). Pure: used by the server checks,
 * the admin menu and the Admins & roles form. The Super admin has every permission.
 */

/** Each admin area, and whether it has a "manage" level on top of "view". */
export const ADMIN_AREAS = {
  dashboard: { manage: false },
  live: { manage: false },
  contests: { manage: true },
  designs: { manage: true },
  reports: { manage: true },
  claims: { manage: true },
  users: { manage: true },
  unpaid: { manage: false },
  payments: { manage: false },
  withdrawals: { manage: true },
  agreements: { manage: true },
  monthly: { manage: true },
  support: { manage: true },
  messages: { manage: true },
  content: { manage: true },
  settings: { manage: true },
  audit: { manage: false },
} as const;

export type AdminArea = keyof typeof ADMIN_AREAS;
export type PermissionLevel = "view" | "manage";
export type Permission = `${AdminArea}.${PermissionLevel}`;

export const AREA_LIST = Object.keys(ADMIN_AREAS) as AdminArea[];

/** Every permission that exists, in menu order. */
export const ALL_PERMISSIONS: Permission[] = AREA_LIST.flatMap((a) => (ADMIN_AREAS[a].manage ? [`${a}.view`, `${a}.manage`] : [`${a}.view`]) as Permission[]);

export const isPermission = (v: string): v is Permission => (ALL_PERMISSIONS as string[]).includes(v);

const both = (...areas: AdminArea[]): Permission[] => areas.flatMap((a) => (ADMIN_AREAS[a].manage ? [`${a}.view`, `${a}.manage`] : [`${a}.view`]) as Permission[]);
const viewOnly = (...areas: AdminArea[]): Permission[] => areas.map((a) => `${a}.view` as Permission);

export const PRESETS = {
  /** Runs the site day to day: everything except fees/settings and full ID numbers. */
  manager: [...both("dashboard", "live", "contests", "designs", "reports", "claims", "users", "unpaid", "payments", "withdrawals", "monthly", "support", "messages", "content", "audit"), ...viewOnly("agreements", "settings")],
  /** Answers people: support chat, messages to one person, unpaid contests, read-only context. */
  support: [...both("support", "unpaid"), ...viewOnly("dashboard", "live", "contests", "designs", "users", "messages", "payments")],
  /** Keeps designs clean: reports, copy claims, designs and strikes. */
  moderator: [...both("designs", "reports", "claims", "users"), ...viewOnly("dashboard", "contests", "support")],
} satisfies Record<string, Permission[]>;

export type Preset = keyof typeof PRESETS;
export const PRESET_NAMES = Object.keys(PRESETS) as Preset[];

export type AdminIdentity = { role: string; status: string; isSuperAdmin: boolean; adminActive: boolean; adminPermissions: string[] };

/** True when this account may use the admin panel at all. */
export const isActiveAdmin = (u: AdminIdentity | null | undefined): boolean =>
  !!u && u.role === "admin" && u.status === "active" && (u.isSuperAdmin || u.adminActive);

/** True when this admin has the permission. "manage" includes "view". */
export function hasPermission(u: AdminIdentity | null | undefined, perm: Permission): boolean {
  if (!isActiveAdmin(u)) return false;
  if (u!.isSuperAdmin) return true;
  const [area] = perm.split(".") as [AdminArea, PermissionLevel];
  return u!.adminPermissions.includes(perm) || (perm.endsWith(".view") && u!.adminPermissions.includes(`${area}.manage`));
}

/** Cleans a submitted permission list: known ones only, and "manage" always brings its "view". */
export function cleanPermissions(input: unknown): Permission[] {
  const list = Array.isArray(input) ? input.filter((p): p is Permission => typeof p === "string" && isPermission(p)) : [];
  const set = new Set<Permission>(list);
  for (const p of list) if (p.endsWith(".manage")) set.add(p.replace(".manage", ".view") as Permission);
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}

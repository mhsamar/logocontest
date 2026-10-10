import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey, Translate } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";

/** Live now and Analytics (design/admin, owner 2026-10-10): page addresses in plain words. */

const clean = (path: string) => path.split(/[?#]/)[0] || "/";

/** Sending a design or going through Start a contest: the visits that matter most right now. */
export const isImportant = (path: string) => /^\/contest\/[^/]+\/submit/.test(clean(path)) || clean(path) === "/start" || clean(path).startsWith("/start/");

/** The contest a page belongs to, and whether it is its submit page. */
export function contestOfPath(path: string): { slug: string; submit: boolean } | null {
  const m = clean(path).match(/^\/contest\/([^/]+)(\/submit)?/);
  return m ? { slug: m[1], submit: Boolean(m[2]) } : null;
}

const EXACT: Record<string, MessageKey> = {
  "/": "admin.live.pages.home",
  "/how-it-works": "admin.live.pages.how",
  "/contests": "admin.live.pages.contests",
  "/winners": "admin.live.pages.winners",
  "/leaderboard": "admin.live.pages.leaderboard",
  "/design-studio": "admin.live.pages.studio",
  "/help": "admin.live.pages.help",
  "/login": "admin.live.pages.login",
  "/designers/signup": "admin.live.pages.signup",
  "/notifications": "admin.live.pages.notifications",
  "/support": "admin.live.pages.support",
};

/** "Sending a design · Nodi Tea House", "Home page"…; pages without a name show their address. */
export function pageName(path: string, brands: Map<string, string>, t: Translate): string {
  const p = clean(path);
  const contest = contestOfPath(p);
  if (contest) {
    const brand = brands.get(contest.slug);
    const what = contest.submit ? t("admin.live.pages.submit") : t("admin.live.pages.contest");
    return brand ? `${what} · ${brand}` : what;
  }
  if (EXACT[p]) return t(EXACT[p]);
  if (p === "/start" || p.startsWith("/start/")) return t("admin.live.pages.start");
  if (p === "/dashboard" || p.startsWith("/dashboard/")) return t("admin.live.pages.dashboard");
  if (p.startsWith("/legal/")) return t("admin.live.pages.legal");
  if (p.startsWith("/d/")) return t("admin.live.pages.designer");
  if (p.startsWith("/c/")) return t("admin.live.pages.client");
  return p;
}

export const PAGE_GROUPS = ["contests", "home", "account", "info", "signup", "start", "other"] as const;
export type PageGroup = (typeof PAGE_GROUPS)[number];

/** Which part of the site a page is in ("What people look at"). */
export function pageGroup(path: string): PageGroup {
  const p = clean(path);
  if (p === "/") return "home";
  if (p === "/contests" || p.startsWith("/contest/") || p === "/winners") return "contests";
  if (p === "/login" || p === "/dashboard" || p.startsWith("/dashboard/") || p === "/forgot-password" || p === "/reset-password" || p === "/verify-email") return "account";
  if (p === "/how-it-works" || p === "/help" || p.startsWith("/legal/")) return "info";
  if (p === "/designers/signup") return "signup";
  if (p === "/start" || p.startsWith("/start/")) return "start";
  return "other";
}

/** Brand names of the contests in these page addresses, by slug. */
export async function brandsForPaths(paths: string[]): Promise<Map<string, string>> {
  const slugs = [...new Set(paths.map((p) => contestOfPath(p)?.slug).filter((s): s is string => Boolean(s)))];
  if (!slugs.length || !isSupabaseConfigured()) return new Map();
  const { data } = await createAdminClient().from("contests").select("slug, brand_name").in("slug", slugs);
  return new Map((data ?? []).map((c) => [c.slug as string, c.brand_name as string]));
}

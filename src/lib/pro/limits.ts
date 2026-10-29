import "server-only";
import { canSeeNewContest, entryLimit } from "./rules";
import { checkWindowFor } from "./logo-checks";
import { getProSettings } from "./settings";
import { isPro } from "./status";

/**
 * Designs this designer may send to one contest (0 = unlimited): Basic 5 and Pro unlimited from Admin › Pro plan,
 * never above the site-wide setting. Before migration 0046 only the site-wide setting applies (as before).
 */
export async function designsAllowed(designerId: string, siteMax: number): Promise<number> {
  const { settings, ready } = await getProSettings();
  if (!ready) return siteMax;
  return entryLimit(await isPro(designerId), settings, siteMax);
}

/** Logo checks for this designer: Basic 2 and Pro 20 a month, the free trial 5 in all (Admin › Pro plan; owner, 2026-10-29). */
export async function logoChecksAllowed(designerId: string): Promise<number> {
  return (await checkWindowFor(designerId)).limit;
}

/**
 * Early access (owner, 2026-10-13): may this person see a contest that opened at startsAt? Pro designers, the
 * contest's client and admins always; everyone else after the early-access window. Before migration 0046: everyone.
 */
export async function contestVisibleTo(startsAt: Date | null, viewer: { id: string; role: string } | null): Promise<boolean> {
  const { settings, ready } = await getProSettings();
  if (!ready || !startsAt) return true;
  if (viewer?.role === "admin") return true;
  const pro = viewer?.role === "designer" ? await isPro(viewer.id) : false;
  return canSeeNewContest(startsAt, pro, settings);
}

/**
 * Early access for lists (owner, 2026-10-13): contests that opened after the returned time are hidden from this
 * viewer; null = show everything (Pro designers, admins, the window is off, or migration 0046 hasn't run).
 */
export async function earlyCutoff(viewer: { id: string; role: string } | null, now: Date = new Date()): Promise<Date | null> {
  const { settings, ready } = await getProSettings();
  if (!ready || !settings.features.early_access || settings.earlyAccessMinutes <= 0) return null;
  if (viewer?.role === "admin") return null;
  if (viewer?.role === "designer" && (await isPro(viewer.id))) return null;
  return new Date(now.getTime() - settings.earlyAccessMinutes * 60_000);
}

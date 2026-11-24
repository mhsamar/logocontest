/**
 * The winner's delivery stopwatch (owner, 2026-11-24): from the moment the winner is picked, the designer has
 * `timers.files_strike_hours` (24 by default) to send the first final files, the same deadline the lifecycle job
 * suspends on. Pure, so the server and the ticking clock agree.
 */

/** When the first files are due: the pick time plus the strike hours. */
export const firstFilesDeadline = (pickedAt: Date, strikeHours: number) => new Date(pickedAt.getTime() + strikeHours * 3_600_000);

export type CountdownTone = "calm" | "soon" | "urgent" | "over";

/** Under 6 hours "soon", under 1 hour "urgent", past the deadline "over". */
export function countdownTone(msLeft: number): CountdownTone {
  if (msLeft <= 0) return "over";
  if (msLeft < 3_600_000) return "urgent";
  if (msLeft < 6 * 3_600_000) return "soon";
  return "calm";
}

/** Hours, minutes and seconds left (hours may pass 24); all zero once the time is up. */
export function countdownParts(msLeft: number): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

/** How much of the time is used, 0 to 1, for the bar under the clock. */
export function countdownUsed(msLeft: number, totalMs: number): number {
  if (totalMs <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - msLeft / totalMs));
}

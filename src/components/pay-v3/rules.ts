import type { VoiceCue } from "@/lib/payments/pay-v3";

/**
 * The contest payment screens' small rules (owner, 2026-11-06), apart from the components so they are tested.
 */

/** The visitor's own mute of the voice guide: muted once, it never plays by itself again. */
export const VOICE_MUTED_KEY = "lc_voice_muted";
/** The voice guide plays by itself once per contest. */
export const voicePlayedKey = (contestId: string) => `lc_voice_played:${contestId}`;

/** The voice guide's line at this second (from ≤ t < to), or null. */
export function cueAt(cues: readonly VoiceCue[], t: number): VoiceCue | null {
  return cues.find((c) => t >= c.from && t < c.to) ?? null;
}

/** A TrxID typed or pasted: capitals, no spaces; a whole SMS pasted gives the code after "TrxID". */
export function cleanTrx(input: string): string {
  const m = /trx\s*id[:\s]*([A-Za-z0-9]{8,14})/i.exec(input);
  return (m ? m[1] : input).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 14);
}

/** The WhatsApp help message, with the contest's reference so the team finds the payment. */
export function helpMessage(greeting: string, reference: string | null): string {
  return reference ? `${greeting} (${reference})` : greeting;
}

/** Contest statuses anyone may see. Drafts, unpaid and cancelled contests are only for their owner. */
export const PUBLIC_STATUSES = ["open", "judging", "winner_selected", "handover", "completed", "no_result"] as const;
export type PublicStatus = (typeof PUBLIC_STATUSES)[number];

/**
 * A finished contest is read-only for everyone on the public page (owner, 2026-10-11): no comments, likes, reports or
 * saves. Its owner still has their dashboard.
 */
export const FINISHED_STATUSES = ["completed", "no_result"] as const;
export const isFinished = (status: string) => (FINISHED_STATUSES as readonly string[]).includes(status);

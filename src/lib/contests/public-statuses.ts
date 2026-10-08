/** Contest statuses anyone may see. Drafts, unpaid and cancelled contests are only for their owner. */
export const PUBLIC_STATUSES = ["open", "judging", "winner_selected", "handover", "completed", "no_result"] as const;
export type PublicStatus = (typeof PUBLIC_STATUSES)[number];

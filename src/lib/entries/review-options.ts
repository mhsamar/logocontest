/** Why a client rejects a design (UI-JOURNEY C-15). Texts under manage.reject.reasons.* */
export const REJECT_REASONS = ["ai", "copied", "brief", "quality", "other"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

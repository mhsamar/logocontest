/** Why a design is reported (owner, 2026-10-08; BLUEPRINT §5 reports). Texts under entry.report.reasons.* */
export const REPORT_REASONS = ["copied", "ai", "trademark", "contact_info", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_NOTE_MAX = 500;
export const REPORT_MAX_LINKS = 5;

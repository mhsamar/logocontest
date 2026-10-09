import type { NotificationType } from "./types";

/**
 * Notification categories (owner, 2026-10-09): every notification belongs to one, and each category has its own
 * colour, icon and label in the bell and on /notifications.
 */
export const CATEGORIES = [
  "newContest",
  "newDesign",
  "brief",
  "rating",
  "feedback",
  "reply",
  "comment",
  "like",
  "ending",
  "winner",
  "files",
  "approved",
  "money",
  "safety",
  "support",
  "admin",
] as const;
export type NotificationCategory = (typeof CATEGORIES)[number];

export const CATEGORY_OF: Record<NotificationType, NotificationCategory> = {
  // Designers
  contest_new: "newContest",
  contest_new_private: "newContest",
  brief_updated: "brief",
  entry_rated: "rating",
  entry_comment_client: "feedback",
  entry_comment_other: "comment",
  entry_comment: "comment",
  contest_comment: "comment",
  design_liked: "like",
  contest_ending: "ending",
  contest_ending_private: "ending",
  ending_soon_designer: "ending",
  contest_ended_entered: "ending",
  contest_extended: "ending",
  winner_picked: "winner",
  contest_closed: "winner",
  monthly_champion: "winner",
  monthly_announced: "winner",
  gift_sent: "winner",
  files_due: "files",
  handover_revision: "files",
  handover_approved: "approved",
  handover_approved_held: "approved",
  prize_released: "money",
  no_result_share: "money",
  withdrawal_paid: "money",
  withdrawal_rejected: "money",
  // Clients
  entry_new: "newDesign",
  entry_comment_designer: "reply",
  design_liked_client: "like",
  handover_submitted: "files",
  ending_soon: "ending",
  ending_soon_extend: "ending",
  judging_started: "ending",
  no_result_client: "ending",
  judging_reminder: "winner",
  repick_winner: "winner",
  winner_picked_by_admin: "winner",
  // Safety and moderation
  entry_rejected: "safety",
  entry_removed: "safety",
  win_cancelled: "safety",
  strike_received: "safety",
  account_suspended: "safety",
  account_banned: "safety",
  flag_warning: "safety",
  report_upheld: "safety",
  report_dismissed: "safety",
  contest_cancelled: "safety",
  contest_cancelled_client: "safety",
  claim_opened: "safety",
  claim_rejected_client: "safety",
  claim_rejected_designer: "safety",
  claim_correction_client: "safety",
  claim_correction_designer: "safety",
  claim_upheld_client: "safety",
  claim_fined: "safety",
  claim_banned: "safety",
  // Support chat and team messages
  support_reply: "support",
  admin_message: "support",
  // Admins
  support_message_admin: "admin",
  claim_opened_admin: "admin",
  monthly_proposed: "admin",
  gift_address_given: "admin",
};

const P = {
  plus: "M12 5v14M5 12h14",
  pen: "M4 20h4L19 9l-4-4L4 16Z",
  star: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z",
  bubble: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.7A8 8 0 1 1 21 12Z",
  reply: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 5 5v6",
  heart: "M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4",
  upload: "M12 15V3M7 8l5-5 5 5M5 21h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  wallet: "M3 7h18v12H3ZM3 11h18M16 15h2",
  shield: "M12 8v5M12 16.5h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8",
};

/** Icon path, icon tile colours and the label chip colours for each category. */
export const CATEGORY_STYLE: Record<NotificationCategory, { d: string; tile: string; chip: string; bar: string }> = {
  newContest: { d: P.sparkle, tile: "bg-primary/10 text-primary", chip: "bg-primary/10 text-primary", bar: "bg-primary" },
  newDesign: { d: P.plus, tile: "bg-[#ffe4ec] text-[#be123c]", chip: "bg-[#ffe4ec] text-[#be123c]", bar: "bg-[#e11d48]" },
  brief: { d: P.pen, tile: "bg-[#f1ecff] text-[#5b21b6]", chip: "bg-[#f1ecff] text-[#5b21b6]", bar: "bg-[#7c3aed]" },
  rating: { d: P.star, tile: "bg-[#fff7e0] text-[#a16207]", chip: "bg-[#fff7e0] text-[#a16207]", bar: "bg-[#eab308]" },
  feedback: { d: P.bubble, tile: "bg-[#e8f1ff] text-[#1d4ed8]", chip: "bg-[#e8f1ff] text-[#1d4ed8]", bar: "bg-[#2563eb]" },
  reply: { d: P.reply, tile: "bg-[#dff7f3] text-[#0f766e]", chip: "bg-[#dff7f3] text-[#0f766e]", bar: "bg-[#14b8a6]" },
  comment: { d: P.bubble, tile: "bg-[#e3f4fc] text-[#0369a1]", chip: "bg-[#e3f4fc] text-[#0369a1]", bar: "bg-[#0ea5e9]" },
  like: { d: P.heart, tile: "bg-[#fde7f3] text-[#be185d]", chip: "bg-[#fde7f3] text-[#be185d]", bar: "bg-[#ec4899]" },
  ending: { d: P.clock, tile: "bg-[#ffedd5] text-[#c2410c]", chip: "bg-[#ffedd5] text-[#c2410c]", bar: "bg-[#f97316]" },
  winner: { d: P.trophy, tile: "bg-gradient-to-br from-[#fdf3c7] to-[#f6d98b] text-[#7a5300]", chip: "bg-[#fdf3c7] text-[#7a5300]", bar: "bg-[#d4a017]" },
  files: { d: P.upload, tile: "bg-[#e9e7ff] text-[#4338ca]", chip: "bg-[#e9e7ff] text-[#4338ca]", bar: "bg-[#6366f1]" },
  approved: { d: P.check, tile: "bg-[#e7f8f0] text-[#0f6b45]", chip: "bg-[#e7f8f0] text-[#0f6b45]", bar: "bg-[#22c55e]" },
  money: { d: P.wallet, tile: "bg-[#d1fae5] text-[#047857]", chip: "bg-[#d1fae5] text-[#047857]", bar: "bg-[#10b981]" },
  support: { d: P.bubble, tile: "bg-[#ede9fe] text-[#6d28d9]", chip: "bg-[#ede9fe] text-[#6d28d9]", bar: "bg-[#8b5cf6]" },
  safety: { d: P.shield, tile: "bg-danger/10 text-danger", chip: "bg-danger/10 text-danger", bar: "bg-danger" },
  admin: { d: P.gear, tile: "bg-[#e2e8f0] text-[#334155]", chip: "bg-[#e2e8f0] text-[#334155]", bar: "bg-[#64748b]" },
};

export const categoryOf = (type: NotificationType): NotificationCategory => CATEGORY_OF[type] ?? "admin";
export const isCategory = (v: string): v is NotificationCategory => (CATEGORIES as readonly string[]).includes(v);

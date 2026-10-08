import { z } from "zod";

const int = (min = 0, max = Number.MAX_SAFE_INTEGER) => z.number().int().min(min).max(max);
const intList = z.array(z.number().int().positive()).min(1);

/** Empty (icon hidden) or an https link on one of the platform's own domains. */
const socialUrl = (hosts: string[]) =>
  z.string().refine((v) => {
    if (v === "") return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" && hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
    } catch {
      return false;
    }
  }, "Must be empty or an https link on the platform's own site");

/**
 * Every admin-changeable value (BLUEPRINT.md §2, §6, §7, §9, §10, §11, §12).
 * Code reads these through getSetting(); the defaults below only seed the
 * settings table (`npm run seed`). Keys marked [CONFIRM] are proposed defaults
 * the owner has not confirmed yet (BLUEPRINT §18).
 *
 * Groups match the A-11 settings form: fees, packages, upgrades, timers,
 * limits, monthly — plus auth for login/OTP.
 */
export const SETTINGS = {
  // ---- Fees and tiers (§2, §7.1, §7.2) ------------------------------------
  "fees.client_service_fee_percent": {
    group: "fees", type: "int", schema: int(0, 100), default: 20,
    description: "Service fee added on top of the prize, in percent.",
  },
  "fees.designer_tiers": {
    group: "fees", type: "json",
    schema: z.array(z.object({ min_wins: int(), rate_percent: int(0, 100) })).min(1),
    // Owner, 2026-10-08: 15% to start, 10% after 10 wins, 5% after 50 wins.
    default: [
      { min_wins: 0, rate_percent: 15 },
      { min_wins: 10, rate_percent: 10 },
      { min_wins: 50, rate_percent: 5 },
    ],
    description: "Designer fee by counted wins before this win (0–9: 15%, 10–49: 10%, 50+: 5%).",
  },
  "fees.counted_win_min_prize": {
    group: "fees", type: "int", schema: int(), default: 3000,
    description: "A win only counts toward tiers and the leaderboard at or above this prize.",
  },
  "fees.counted_win_min_designers": {
    group: "fees", type: "int", schema: int(1), default: 3,
    description: "A win only counts if at least this many different designers entered.",
  },
  "fees.counted_wins_max_per_client": {
    group: "fees", type: "int", schema: int(1), default: 2,
    description: "At most this many wins from the same client count.",
  },

  // ---- Packages (§2, §7.1) ------------------------------------------------
  // Owner, 2026-10-08: Starter (economy), Growth (standard), Pro, Premium, Elite.
  "packages.economy_prize": {
    group: "packages", type: "int", schema: int(1), default: 3000,
    description: "Starter package prize (taka).",
  },
  "packages.standard_prize": {
    group: "packages", type: "int", schema: int(1), default: 5000,
    description: "Growth package prize (taka).",
  },
  "packages.pro_prize": {
    group: "packages", type: "int", schema: int(1), default: 8000,
    description: "Pro package prize (taka).",
  },
  "packages.premium_prize": {
    group: "packages", type: "int", schema: int(1), default: 12000,
    description: "Premium package prize (taka).",
  },
  "packages.elite_prize": {
    group: "packages", type: "int", schema: int(1), default: 15000,
    description: "Elite package prize (taka).",
  },
  "packages.custom_min_prize": {
    group: "packages", type: "int", schema: int(1), default: 3000,
    description: "Smallest custom prize (taka).",
  },
  "packages.custom_step": {
    group: "packages", type: "int", schema: int(1), default: 500,
    description: "Custom prize must be a multiple of this (taka).",
  },

  // ---- Upgrades (§7.4) ----------------------------------------------------
  "upgrades.blind_price": {
    group: "upgrades", type: "int", schema: int(), default: 1000,
    description: "Blind contest upgrade price (taka).",
  },
  "upgrades.private_price": {
    group: "upgrades", type: "int", schema: int(), default: 1000,
    description: "Private contest upgrade price (taka).",
  },
  "upgrades.extension_price_per_day": {
    group: "upgrades", type: "int", schema: int(1), default: 500,
    description: "Price of each day added by a paid extension (taka). Extensions are never free or automatic.",
  },
  "upgrades.extension_days_options": {
    group: "upgrades", type: "json", schema: intList, default: [3, 5, 7],
    description: "Days a client can add with one paid extension.",
  },
  "upgrades.promoted_price": {
    group: "upgrades", type: "int", schema: int(), default: 1000,
    description: "Promoted contest upgrade price (taka).",
  },
  "upgrades.logo_scan_price": {
    group: "upgrades", type: "int", schema: int(), default: 500,
    description: "Price of the Logo Scan add-on (taka, once per contest; owner, 2026-10-08).",
  },
  "upgrades.highlight_price": {
    group: "upgrades", type: "int", schema: int(), default: 500,
    description: "Highlight add-on: gold border and badge in lists (taka).",
  },
  "upgrades.urgent_price": {
    group: "upgrades", type: "int", schema: int(), default: 500,
    description: "Urgent add-on: \"Urgent\" badge (taka).",
  },
  "upgrades.nda_price": {
    group: "upgrades", type: "int", schema: int(), default: 1500,
    description: "NDA add-on: designers accept a confidentiality agreement; includes Private (taka).",
  },

  // ---- Timers (§2, §6, §12) -----------------------------------------------
  "timers.contest_duration_options_days": {
    group: "timers", type: "json", schema: intList, default: [3, 5, 7, 10, 14, 21, 30],
    description: "Quick-pick contest lengths shown as chips (days).",
  },
  "timers.contest_duration_min_days": {
    group: "timers", type: "int", schema: int(1), default: 3,
    description: "Shortest contest the client can choose (days).",
  },
  "timers.contest_duration_max_days": {
    group: "timers", type: "int", schema: int(1), default: 30,
    description: "Longest contest the client can choose (days).",
  },
  "timers.contest_duration_default_days": {
    group: "timers", type: "int", schema: int(1), default: 7,
    description: "Pre-selected contest length (days).",
  },
  "timers.judging_window_days": {
    group: "timers", type: "int", schema: int(1), default: 5,
    description: "Days the client has to pick a winner; then the highest-rated entry wins.",
  },
  "timers.repick_window_days": {
    group: "timers", type: "int", schema: int(1), default: 3,
    description: "Days the client has to pick another winner after the first one missed the file deadline.",
  },
  "timers.designer_file_upload_days": {
    group: "timers", type: "int", schema: int(1), default: 3,
    description: "Days the winner has to upload the final files.",
  },
  "timers.client_response_days": {
    group: "timers", type: "int", schema: int(1), default: 5,
    description: "Days the client has to approve or request a change after files are submitted; then the contest ends with no result.",
  },
  "timers.judging_reminder_days": {
    group: "timers", type: "json", schema: intList, default: [1, 3, 5],
    description: "Judging days on which the client gets a pick-a-winner reminder.",
  },
  "timers.ending_soon_notice_hours": {
    group: "timers", type: "int", schema: int(1), default: 24,
    description: "Hours before the end when the 'contest ends soon' notice goes out.",
  },
  "timers.new_entry_digest_hours": {
    group: "timers", type: "int", schema: int(1), default: 3,
    description: "New-entry emails to the client are batched over this many hours.",
  },
  "timers.strike_suspension_days": {
    group: "timers", type: "int", schema: int(1), default: 14,
    description: "Suspension length on a second strike (days).",
  },

  // ---- Limits (§6, §7.3, §8.1, §9) ----------------------------------------
  "limits.low_entry_prompt_threshold": {
    group: "limits", type: "int", schema: int(1), default: 5,
    description: "Below this many active entries, the client is prompted to buy an extension.",
  },
  "limits.contest_comment_max_length": {
    group: "limits", type: "int", schema: int(50), default: 500,
    description: "Characters allowed in one public contest comment.",
  },
  "limits.designer_bio_max_length": {
    group: "limits", type: "int", schema: int(50), default: 300,
    description: "Characters allowed in a designer's bio.",
  },
  "limits.avatar_max_mb": {
    group: "limits", type: "int", schema: int(1), default: 2,
    description: "Largest stored profile photo in MB, after the browser crops it to 512×512 (users may pick photos of any size).",
  },
  "limits.max_revision_requests": {
    group: "limits", type: "int", schema: int(), default: 2,
    description: "Change requests a client can make during handover.",
  },
  "limits.max_entries_per_designer": {
    group: "limits", type: "int", schema: int(), default: 0,
    description: "Entries one designer can submit to one contest. 0 = unlimited.",
  },
  "limits.entry_min_images": {
    group: "limits", type: "int", schema: int(1), default: 1,
    description: "Minimum mockups per design.",
  },
  "limits.entry_max_images": {
    group: "limits", type: "int", schema: int(1, 8), default: 8,
    description: "Maximum mockups per design. A designer who wants more submits another design.",
  },
  "limits.entry_image_max_mb": {
    group: "limits", type: "int", schema: int(1), default: 5,
    description: "Largest entry image (MB).",
  },
  "limits.entry_image_min_px": {
    group: "limits", type: "int", schema: int(1), default: 1000,
    description: "Every design mockup is stored as this many pixels square; the browser fits any image into it automatically.",
  },
  "limits.entry_preview_max_px": {
    group: "limits", type: "int", schema: int(1), default: 1000,
    description: "Long side of the design preview (px).",
  },
  "limits.brief_max_files": {
    group: "limits", type: "int", schema: int(), default: 5,
    description: "Example / current-logo files a client can upload in the wizard.",
  },
  "limits.brief_file_max_mb": {
    group: "limits", type: "int", schema: int(1), default: 5,
    description: "Largest wizard upload (MB).",
  },
  "limits.withdrawal_min": {
    group: "limits", type: "int", schema: int(1), default: 500,
    description: "Smallest withdrawal (taka).",
  },
  "limits.approval_feedback_max_words": {
    group: "limits", type: "int", schema: int(1), default: 120,
    description: "Most words in the client's feedback when approving the final files.",
  },
  "limits.strikes_for_suspension": {
    group: "limits", type: "int", schema: int(1), default: 2,
    description: "Strikes that trigger a suspension.",
  },
  "limits.strikes_for_ban": {
    group: "limits", type: "int", schema: int(1), default: 3,
    description: "Strikes that trigger a permanent ban.",
  },
  "limits.false_flag_warnings_for_ban": {
    group: "limits", type: "int", schema: int(1), default: 3,
    description: "False-flag warnings that trigger a permanent ban.",
  },
  "limits.top_designer_min_wins": {
    group: "limits", type: "int", schema: int(1), default: 10,
    description: "Counted wins needed for the Top Designer badge.",
  },

  // ---- Monthly Champion (§11) ---------------------------------------------
  "monthly.champion_prize": {
    group: "monthly", type: "int", schema: int(), default: 5000,
    description: "Monthly Champion bonus, added to the wallet (taka).",
  },

  // ---- Auth (§4, §15) -----------------------------------------------------
  "otp.length": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(4).max(8),
    default: 6,
    description: "Number of digits in an SMS verification code.",
  },
  "otp.ttl_minutes": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1).max(60),
    default: 5,
    description: "Minutes before an SMS code expires.",
  },
  "otp.resend_cooldown_seconds": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(0).max(3600),
    default: 60,
    description: "Seconds a user must wait before asking for another code.",
  },
  "otp.max_per_phone_per_hour": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1),
    default: 5,
    description: "Codes one mobile number can request per hour.",
  },
  "otp.max_per_ip_per_hour": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1),
    default: 20,
    description: "Codes one IP address can request per hour.",
  },
  "otp.max_verify_attempts": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1).max(20),
    default: 5,
    description: "Wrong guesses allowed for one code.",
  },
  "otp.ticket_ttl_minutes": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1).max(120),
    default: 15,
    description: "Minutes a verified number stays valid to finish signup or reset.",
  },
  "auth.email_code_length": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(4).max(8),
    default: 6,
    description: "Digits in the confirm-your-email code.",
  },
  "auth.email_code_ttl_minutes": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(5).max(1440),
    default: 30,
    description: "Minutes a confirm-your-email code stays valid.",
  },
  "auth.email_code_max_attempts": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1).max(10),
    default: 5,
    description: "Wrong tries allowed per confirm-your-email code.",
  },
  "auth.email_code_resend_seconds": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(0).max(600),
    default: 60,
    description: "Seconds before a new confirm-your-email code can be sent.",
  },
  "auth.email_max_per_address_per_hour": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1),
    default: 3,
    description: "Confirmation or reset emails one address can be sent per hour.",
  },
  "auth.email_max_per_ip_per_hour": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1),
    default: 10,
    description: "Confirmation or reset emails one IP address can request per hour.",
  },
  "auth.password_min_length": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(6).max(72),
    default: 8,
    description: "Minimum password length.",
  },
  "auth.login_max_failures_per_phone": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1),
    default: 5,
    description: "Failed logins for one number before it is locked for the window.",
  },
  "auth.login_max_failures_per_ip": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1),
    default: 20,
    description: "Failed logins from one IP before it is locked for the window.",
  },
  "auth.login_window_minutes": {
    group: "auth",
    type: "int",
    schema: z.number().int().min(1).max(1440),
    default: 15,
    description: "Window (minutes) used to count failed logins.",
  },

  // ---- Site: social links in the footer (owner, 2026-10-08) --------------
  // Empty = the icon is hidden. Only links on the platform's own domain are accepted.
  "social.facebook": {
    group: "site", type: "string", schema: socialUrl(["facebook.com", "fb.com"]), default: "https://www.facebook.com/Businessviewbd/",
    description: "Facebook page link (https://facebook.com/…). Empty hides the icon.",
  },
  "social.facebook_group": {
    group: "site", type: "string", schema: socialUrl(["facebook.com", "fb.com"]), default: "https://www.facebook.com/groups/freelancingvideoediting",
    description: "Facebook group link (https://facebook.com/groups/…). Empty hides the icon.",
  },
  "social.instagram": {
    group: "site", type: "string", schema: socialUrl(["instagram.com"]), default: "https://www.instagram.com/logocontest.bd/",
    description: "Instagram link (https://instagram.com/…). Empty hides the icon.",
  },
  "social.youtube": {
    group: "site", type: "string", schema: socialUrl(["youtube.com", "youtu.be"]), default: "",
    description: "YouTube channel link (https://youtube.com/…). Empty hides the icon.",
  },
  "social.linkedin": {
    group: "site", type: "string", schema: socialUrl(["linkedin.com"]), default: "",
    description: "LinkedIn page link (https://linkedin.com/…). Empty hides the icon.",
  },

  // ---- Help page: WhatsApp and live chat (owner, 2026-10-08; UI-JOURNEY P-14) ----
  "contact.whatsapp": {
    group: "site", type: "string", schema: z.string().regex(/^01[3-9]\d{8}$/, "A Bangladesh mobile number like 01712028511"), default: "01712028511",
    description: "WhatsApp number on the Help page (01XXXXXXXXX).",
  },
  "chat.driver": {
    group: "site", type: "string", schema: z.enum(["none", "tawk"]), default: "none",
    description: "Live chat on the Help page: none (off) or tawk (Tawk.to, needs the two IDs below).",
  },
  "chat.tawk_property_id": {
    group: "site", type: "string", schema: z.string().regex(/^([a-f0-9]{24})?$/, "The 24-character Tawk.to property ID"), default: "",
    description: "Tawk.to property ID (Administration → Chat Widget, the first part of the widget link).",
  },
  "chat.tawk_widget_id": {
    group: "site", type: "string", schema: z.string().regex(/^([a-z0-9]{6,32})?$/, "The Tawk.to widget ID"), default: "",
    description: "Tawk.to widget ID (the second part of the widget link).",
  },
} as const satisfies Record<string, SettingDefinition>;

export type SettingDefinition = {
  group: string;
  type: "int" | "bool" | "string" | "json";
  schema: z.ZodType;
  default: unknown;
  description: string;
};

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;

/** Parses a raw stored value, falling back to the default if it is invalid. */
export function parseSetting<K extends SettingKey>(key: K, raw: unknown): SettingValue<K> {
  const def = SETTINGS[key];
  const parsed = def.schema.safeParse(raw);
  if (parsed.success) return parsed.data as SettingValue<K>;
  if (raw !== undefined) console.warn(`[settings] invalid value for "${key}", using default`);
  return def.default as SettingValue<K>;
}

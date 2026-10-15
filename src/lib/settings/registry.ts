import { z } from "zod";
import { howVideoSchema, NO_VIDEO } from "@/lib/home/how-video";

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
  // Owner, 2026-10-08: 25%, or 15% when the prize is above ৳30,000.
  "fees.client_service_fee_percent": {
    group: "fees", type: "int", schema: int(0, 100), default: 25,
    description: "Service fee added on top of the prize, in percent.",
  },
  "fees.client_service_fee_large_percent": {
    group: "fees", type: "int", schema: int(0, 100), default: 15,
    description: "Service fee for prizes above the amount below, in percent.",
  },
  "fees.client_service_fee_large_from": {
    group: "fees", type: "int", schema: int(1), default: 30000,
    description: "Prizes above this amount (taka) get the lower service fee.",
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
  // Owner, 2026-10-13: free with 20 checks from a ৳5,000 prize; below that ৳250 for 10 checks.
  "upgrades.logo_scan_price": {
    group: "upgrades", type: "int", schema: int(), default: 250,
    description: "Price of the AI logo checker add-on for contests under the free prize (taka). It gives the paid number of checks (Limits).",
  },
  "upgrades.logo_check_free_from": {
    group: "upgrades", type: "int", schema: int(), default: 5000,
    description: "Contests with this prize (taka) or more get the AI logo checker free.",
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
  // Owner, 2026-10-12: 3 days to pick a winner (was 5).
  "timers.judging_window_days": {
    group: "timers", type: "int", schema: int(1), default: 3,
    description: "Days the client has to pick a winner after the contest ends; then it ends with no result and the prize is shared.",
  },
  "timers.repick_window_days": {
    group: "timers", type: "int", schema: int(1), default: 3,
    description: "Days the client has to pick another winner after the first one missed the file deadline.",
  },
  "timers.designer_file_upload_days": {
    group: "timers", type: "int", schema: int(1), default: 3,
    description: "Days the winner has to upload the final files.",
  },
  // Owner, 2026-10-09 (§7.3, §7.6): copy-claim window and payout hold, counted from the winner pick.
  "timers.copy_claim_days": {
    group: "timers", type: "int", schema: int(1, 30), default: 3,
    description: "Days after the winner is picked when the client can claim the design is copied. The prize is held until they pass.",
  },
  "timers.client_response_days": {
    group: "timers", type: "int", schema: int(1), default: 5,
    description: "Days the client has to approve or request a change after files are submitted; then the contest ends with no result.",
  },
  "timers.judging_reminder_days": {
    group: "timers", type: "json", schema: intList, default: [1, 3, 5],
    description: "Judging days on which the client gets a pick-a-winner reminder.",
  },
  // Owner, 2026-10-09: every designer hears 12 and 6 hours before a contest ends.
  "timers.designer_ending_notice_hours": {
    group: "timers", type: "json", schema: intList, default: [12, 6],
    description: "Hours before a contest ends when every designer is told to submit.",
  },
  // Owner, 2026-10-09: the winner is reminded to send the final files before the deadline.
  "timers.files_due_notice_hours": {
    group: "timers", type: "int", schema: int(1, 72), default: 24,
    description: "Hours before the file deadline when the winner is reminded to send the final files.",
  },
  "timers.ending_soon_notice_hours": {
    group: "timers", type: "int", schema: int(1), default: 24,
    description: "Hours before the end when the 'contest ends soon' notice goes out.",
  },
  // Owner, 2026-10-15: the new-designs email (client-new-entries) goes at most once in this many hours per contest.
  "timers.new_entry_digest_hours": {
    group: "timers", type: "int", schema: int(1, 168), default: 24,
    description: "Hours between new-designs emails to a client (at most one per contest in this time; 24 = once a day).",
  },
  // Suspension and ban rules (owner, 2026-10-12; migrations 0039, 0041): every rule break is a 48-hour suspension
  // that ends on its own; 3 suspensions within 30 days = permanent ban.
  "timers.suspension_hours": {
    group: "timers", type: "int", schema: int(1, 720), default: 48,
    description: "Hours a suspension lasts. It ends on its own.",
  },
  "timers.strike_expiry_days": {
    group: "timers", type: "int", schema: int(1, 365), default: 30,
    description: "Days a suspension counts toward a ban. 3 suspensions (Limits) inside this time = permanent ban.",
  },
  "timers.files_strike_hours": {
    group: "timers", type: "int", schema: int(1, 72), default: 24,
    description: "Hours the winner has to send the first final files before getting a suspension.",
  },
  "timers.payout_hold_days": {
    group: "timers", type: "int", schema: int(0, 30), default: 3,
    description: "Days after the client approves the files before the prize can be withdrawn.",
  },

  // ---- Limits (§6, §7.3, §8.1, §9) ----------------------------------------
  "limits.low_entry_prompt_threshold": {
    group: "limits", type: "int", schema: int(1), default: 5,
    description: "Below this many active entries, the client is prompted to buy an extension.",
  },
  // Owner, 2026-10-14: the checker is free on every logo contest, 15 checks for each full ৳1,000 of prize.
  "limits.logo_checks_per_1000": {
    group: "limits", type: "int", schema: int(0, 1000), default: 15,
    description: "Free AI logo checks a logo contest gets for each full ৳1,000 of prize (৳3,000 → 45). Failed checks do not count.",
  },
  // US dollar prices for visitors from abroad, paid with Stripe (owner, 2026-10-14). Amounts stay in taka.
  "payments.usd_rate": {
    group: "payments", type: "int", schema: int(1, 1000), default: 122,
    description: "Taka per US dollar. Visitors from abroad see every price in dollars at this rate and pay with Stripe.",
  },
  "payments.usd_markup_percent": {
    group: "payments", type: "int", schema: int(0, 50), default: 0,
    description: "Added to dollar prices to cover card and currency fees, in percent (0 = none).",
  },
  // Logo checker cost report (owner, 2026-10-14): API prices and the taka rate. Each check keeps its own cost.
  "checker.usd_to_bdt": {
    group: "checker", type: "int", schema: int(1, 1000), default: 122,
    description: "Taka per US dollar, used to show the logo checker's API cost in BDT.",
  },
  "checker.cost_lens_cents_per_1000": {
    group: "checker", type: "int", schema: int(0, 1_000_000), default: 400,
    description: "Google Lens image search (SearchAPI): price in US cents per 1,000 searches.",
  },
  "checker.cost_vision_cents_per_1000": {
    group: "checker", type: "int", schema: int(0, 1_000_000), default: 350,
    description: "Google Cloud Vision web detection: price in US cents per 1,000 images.",
  },
  "checker.cost_ai_in_cents_per_m": {
    group: "checker", type: "int", schema: int(0, 1_000_000), default: 30,
    description: "AI model: price in US cents per 1 million input tokens.",
  },
  "checker.cost_ai_out_cents_per_m": {
    group: "checker", type: "int", schema: int(0, 1_000_000), default: 250,
    description: "AI model: price in US cents per 1 million output tokens.",
  },
  "limits.logo_checks_per_contest": {
    group: "limits", type: "int", schema: int(1), default: 20,
    description: "AI logo checks per contest when the checker is free (prize at or over the free limit). Failed checks do not count.",
  },
  "limits.logo_checks_paid": {
    group: "limits", type: "int", schema: int(1), default: 10,
    description: "AI logo checks the paid add-on gives a contest under the free prize. Failed checks do not count.",
  },
  "limits.logo_check_close_from": {
    group: "limits", type: "int", schema: int(1), default: 45,
    description: "AI copyright checker: a found logo this similar (0-100) or more counts as a close match.",
  },
  "limits.logo_check_high_risk_from": {
    group: "limits", type: "int", schema: int(1), default: 85,
    description: "AI copyright checker: a found logo this similar (0-100) or more makes the result High risk.",
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
  // Owner, 2026-10-12: changes go on until the client approves.
  "limits.max_revision_requests": {
    group: "limits", type: "int", schema: int(), default: 0,
    description: "Change requests a client can make during handover. 0 = no limit.",
  },
  // Browse Contests "Big prize" quick filter (owner, 2026-10-11; Design/contest-pages).
  "limits.big_prize_from": {
    group: "limits", type: "int", schema: int(1), default: 10000,
    description: "Browse Contests, \"Big prize\" filter: contests with a prize of at least this many taka.",
  },
  "limits.max_entries_per_designer": {
    group: "limits", type: "int", schema: int(), default: 0,
    description: "Entries one designer can submit to one contest. 0 = unlimited.",
  },
  "limits.entry_min_images": {
    group: "limits", type: "int", schema: int(1), default: 1,
    description: "Minimum mockups per design.",
  },
  // Owner, 2026-10-14: set separately for Basic and Pro designers, up to 20.
  "limits.entry_max_images": {
    group: "limits", type: "int", schema: int(1, 20), default: 8,
    description: "Maximum mockups per design for Basic designers. A designer who wants more submits another design.",
  },
  "limits.entry_max_images_pro": {
    group: "limits", type: "int", schema: int(1, 20), default: 8,
    description: "Maximum mockups per design for Pro designers (and during the free Pro Trial).",
  },
  "limits.entry_image_max_mb": {
    group: "limits", type: "int", schema: int(1), default: 5,
    description: "Largest entry image after the browser makes it light (MB). Designers can pick pictures of any size; this only stops a file that could not be made light.",
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
  "limits.handover_file_max_mb": {
    group: "limits", type: "int", schema: int(1, 500), default: 50,
    description: "Largest final file the winner can upload (MB).",
  },
  "limits.withdrawal_min": {
    group: "limits", type: "int", schema: int(1), default: 500,
    description: "Smallest withdrawal (taka).",
  },
  "limits.approval_feedback_max_words": {
    group: "limits", type: "int", schema: int(1), default: 120,
    description: "Most words in the client's feedback when approving the final files.",
  },
  "limits.strikes_for_ban": {
    group: "limits", type: "int", schema: int(1), default: 3,
    description: "Suspensions within the suspension days (Timers) that trigger a permanent ban.",
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
    default: 10,
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
  // Owner, 2026-10-14: real emails only. Built-in lists catch the common temporary-inbox sites and made-up addresses.
  "auth.blocked_email_domains": {
    group: "auth", type: "string", schema: z.string().max(20000), default: "",
    description: "Extra email domains nobody can sign up with (temporary-inbox sites), e.g. backyr.com. One per line or separated by commas.",
  },
  "auth.allowed_email_domains": {
    group: "auth", type: "string", schema: z.string().max(5000), default: "",
    description: "Email domains that are always accepted, even when the automatic check thinks they are temporary. One per line or separated by commas.",
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
  // Visitor welcome pop-up (owner, 2026-10-13; Design/visitor-popup): new visitors only, after active time and a scroll.
  "popup.on": {
    group: "site", type: "bool", schema: z.boolean(), default: true,
    description: "Show the welcome pop-up (Start a contest / Join as a designer) to new visitors who are not signed in.",
  },
  "popup.seconds": {
    group: "site", type: "int", schema: int(5, 600), default: 20,
    description: "Seconds a new visitor spends on the site (and has scrolled) before the welcome pop-up opens.",
  },
  "popup.snooze_days": {
    group: "site", type: "int", schema: int(1, 365), default: 7,
    description: "Days the welcome pop-up stays hidden on that browser after it is closed or a button is clicked.",
  },
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

  // ---- Ads (owner, 2026-10-14): off until the owner switches them on ---------------------------------------------
  "ads.enabled": {
    group: "ads", type: "bool", schema: z.boolean(), default: false,
    description: "Show ads on the public pages (never in the admin, dashboards, sign-up, checkout or payment pages).",
  },
  "ads.adsense_client": {
    group: "ads", type: "string", schema: z.string().regex(/^(ca-pub-\d{10,20})?$/, "Your AdSense publisher ID, like ca-pub-1234567890123456"), default: "",
    description: "Google AdSense publisher ID (ca-pub-…). Google places the ads itself (Auto ads); choose where in your AdSense account. Also fills /ads.txt.",
  },

  // ---- Logins and devices (owner, 2026-10-14; migration 0055) --------------------------------------------------------
  "security.max_devices": {
    group: "security", type: "int", schema: int(1, 10), default: 3,
    description: "Most devices one client or designer can be logged in on at the same time. A login on one more signs the oldest out.",
  },
  "security.admin_max_devices": {
    group: "security", type: "int", schema: int(1, 10), default: 2,
    description: "Most devices one staff member (admin, moderator, support) can be logged in on at the same time.",
  },
  "security.super_admin_one_device": {
    group: "security", type: "bool", schema: z.boolean(), default: true,
    description: "The Super admin can be logged in on one device only: logging in on another signs the first out.",
  },
  "security.admin_idle_minutes": {
    group: "security", type: "int", schema: int(10, 480), default: 30,
    description: "Staff are signed out after this many minutes without using the site (for example 30, 40, 50 or 60).",
  },
  "security.admin_close_tab_signout": {
    group: "security", type: "bool", schema: z.boolean(), default: true,
    description: "Staff are signed out when every admin tab is closed (within about a minute).",
  },
  "security.impersonate_minutes": {
    group: "security", type: "int", schema: int(5, 240), default: 60,
    description: "\"Log in as this user\" ends on its own after this many minutes.",
  },

  // ---- Emails (owner, 2026-10-15) ------------------------------------------------------------------------------------
  "email.daily_limit": {
    group: "email", type: "int", schema: int(0, 100_000), default: 80,
    description: "Most emails a day other than codes and security emails (the rest of the email plan's daily limit is kept for codes; Resend's free plan sends 100 a day). 0 = no limit.",
  },

  // ---- Support chat (owner, 2026-10-15) ------------------------------------------------------------------------------
  "support.ai_enabled": {
    group: "support", type: "bool", schema: z.boolean(), default: true,
    description: "The AI assistant answers support chats first and passes a chat to the team when a person is needed. Off = every chat goes to the team.",
  },
  "support.ai_daily_limit": {
    group: "support", type: "int", schema: int(1, 500), default: 40,
    description: "Most AI answers one person gets in a day; after that their chat goes to the team.",
  },

  // ---- Admin › Notifications (owner, 2026-10-15): set on that page, not in Settings ---------------------------------
  "notifications.channels": {
    group: "notifications", type: "json", schema: z.record(z.string(), z.array(z.enum(["bell", "push", "email"]))), default: {} as Record<string, ("bell" | "push" | "email")[]>,
    description: "Notices turned off in Admin › Notifications: row → the ways (bell, push, email) turned off.",
  },
  "notify.chat_email_minutes": {
    group: "notifications", type: "int", schema: int(1, 1440), default: 30,
    description: "Chat emails: at most one per conversation in this many minutes.",
  },
  "notify.saved_reminder_hours": {
    group: "notifications", type: "json", schema: z.array(z.number().int().min(1).max(168)).min(1).max(2), default: [24, 2],
    description: "Pro: hours before a saved contest ends when its reminder goes (one or two numbers).",
  },
  "notify.invite_reminder_hours": {
    group: "notifications", type: "int", schema: int(1, 168), default: 24,
    description: "Pro: hours before an invited contest ends when the designer is reminded (if they haven't sent a design).",
  },
  "notify.pro_renewal_days": {
    group: "notifications", type: "json", schema: z.array(z.number().int().min(1).max(30)).min(1).max(2), default: [7, 1],
    description: "Pro: days before the plan ends when the renewal reminder goes (one or two numbers).",
  },
  "notify.upgrade_reminder_hours": {
    group: "notifications", type: "json", schema: z.array(z.number().int().min(1).max(336)).min(1).max(2), default: [1, 72],
    description: "Hours after a designer clicks Upgrade without paying when the reminder goes (one or two numbers).",
  },

  // ---- Trash (owner, 2026-10-14) -------------------------------------------------------------------------------------
  "trash.keep_days": {
    group: "trash", type: "int", schema: int(1, 365), default: 90,
    description: "Deleted contests and users stay in Admin › Trash this many days (they can be restored), then everything about them is erased for good.",
  },
  "trash.unpaid_hours": {
    group: "trash", type: "int", schema: int(0, 2160), default: 72,
    description: "A contest still unpaid this many hours after it was started goes to the Trash on its own (not while a bKash payment waits for approval). 0 = never.",
  },

  // ---- Brand & notice (owner, 2026-10-09; BLUEPRINT §13.1, A-17) — edited in /admin/brand, not Settings ----
  "contact.phone": {
    group: "contact", type: "string", schema: z.string().regex(/^0\d{9,10}$/, "A Bangladesh phone number like 01712028511"), default: "01712028511",
    description: "Support phone: footer, Help page, How it works, home page and legal pages.",
  },
  "contact.email": {
    group: "contact", type: "string", schema: z.union([z.literal(""), z.string().email("A valid email address").max(120)]), default: "",
    description: "Support email shown in the footer and on the Help page. Empty hides it.",
  },
  "contact.address_en": {
    group: "contact", type: "string", schema: z.string().max(300), default: "",
    description: "Office address in English (footer and Help page). Empty hides it.",
  },
  "contact.address_bn": {
    group: "contact", type: "string", schema: z.string().max(300), default: "",
    description: "Office address in Bangla. Empty uses the English one.",
  },
  "brand.logo": {
    group: "brand", type: "string", schema: z.string().regex(/^(logo\/[0-9a-f-]{36}\.(png|jpg|webp|svg))?$/), default: "",
    description: "Site logo in the header and footer (a file in the site bucket). Empty uses the built-in logo.",
  },
  "brand.icon": {
    group: "brand", type: "string", schema: z.string().regex(/^(icon\/[0-9a-f-]{36}\.png)?$/), default: "",
    description: "App icon and browser tab icon (square PNG). Empty uses the built-in icon.",
  },
  "brand.hero": {
    group: "brand", type: "string", schema: z.string().regex(/^(hero\/[0-9a-f-]{36}\.(png|jpg|webp))?$/), default: "",
    description: "Home page hero picture, in place of the example panel. Empty shows the example panel.",
  },
  "brand.share": {
    group: "brand", type: "string", schema: z.string().regex(/^(share\/[0-9a-f-]{36}\.(png|jpg))?$/), default: "",
    description: "Share picture for Facebook and Google (1200×630). Empty uses the built-in card.",
  },
  // Monthly rewards and win cards (owner, 2026-10-11; migration 0035; Admin → Monthly winner)
  // Owner, 2026-10-13: one switch for the whole monthly prizes program (smartphone and gift box). Off hides every
  // offer, race, leaderboard link, claim and champion badge on the site, and the month closes with no winner.
  "rewards.program_on": {
    group: "rewards", type: "bool", schema: z.boolean(), default: true,
    description: "Run the monthly prizes program (smartphone for clients, gift box for designers). Off hides it everywhere.",
  },
  "rewards.win_card_on": {
    group: "rewards", type: "bool", schema: z.boolean(), default: true,
    description: "Send the contest win card to the designer right after a winner is picked.",
  },
  "rewards.smartphone_card_on": {
    group: "rewards", type: "bool", schema: z.boolean(), default: true,
    description: "Send the smartphone card to the top client when the month closes.",
  },
  "rewards.gift_box_card_on": {
    group: "rewards", type: "bool", schema: z.boolean(), default: true,
    description: "Send the gift box card to the top designer when the month closes.",
  },
  "rewards.ask_first": {
    group: "rewards", type: "bool", schema: z.boolean(), default: false,
    description: "Hold the monthly cards until an admin approves them.",
  },
  "rewards.claim_deadline": {
    group: "rewards", type: "string", schema: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]), default: "",
    description: "Last day to claim a monthly prize (YYYY-MM-DD). Empty shows no deadline.",
  },
  "rewards.claim_reminder_days": {
    group: "rewards", type: "int", schema: int(1, 30), default: 3,
    description: "Days between reminders to a monthly prize winner who hasn't claimed yet.",
  },
  "rewards.claim_reminders_max": {
    group: "rewards", type: "int", schema: int(0, 10), default: 3,
    description: "How many claim reminders a monthly prize winner gets at most (0 = none).",
  },
  "home.hero_offer_slide": {
    group: "home", type: "bool", schema: z.boolean(), default: true,
    description: "Show the monthly prizes section (smartphone and gift box) under the live contests on the home page.",
  },
  // Admin → Home hero (owner, 2026-10-11; migration 0034)
  "home.hero_slide_seconds": {
    group: "home", type: "int", schema: int(1, 10), default: 2,
    description: "How many seconds each home hero slide shows.",
  },
  "home.hero_sample_pill": {
    group: "home", type: "bool", schema: z.boolean(), default: true,
    description: "Show the \"Sample artwork\" pill under the home hero slides. Turn it off once the slides are real contest winners.",
  },
  // "How it works" tutorial videos (owner, 2026-10-11): edited in Admin → Homepage, not on the Settings page.
  "how.video_client": {
    group: "how", type: "json", schema: howVideoSchema, default: NO_VIDEO,
    description: "How it works page, For clients: the tutorial video (a YouTube or Vimeo link, checked when saved). Empty hides the video.",
  },
  "how.video_designer": {
    group: "how", type: "json", schema: howVideoSchema, default: NO_VIDEO,
    description: "How it works page, For designers: the tutorial video (a YouTube or Vimeo link, checked when saved). Empty hides the video.",
  },
  "how.video_autoplay": {
    group: "how", type: "bool", schema: z.boolean(), default: true,
    description: "Start the How it works video by itself (muted, with Tap for sound) when it is on screen.",
  },
  "how.cover_client": {
    group: "how", type: "string", schema: z.string().regex(/^(how_client\/[0-9a-f-]{36}\.(png|jpg|webp))?$/), default: "",
    description: "Cover picture of the clients' video, shown before it plays. Empty shows the built-in cover.",
  },
  "how.cover_designer": {
    group: "how", type: "string", schema: z.string().regex(/^(how_designer\/[0-9a-f-]{36}\.(png|jpg|webp))?$/), default: "",
    description: "Cover picture of the designers' video, shown before it plays. Empty shows the built-in cover.",
  },
  // The live designers tag in the home hero (owner, 2026-10-11; migration 0037): shown only from these numbers.
  "home.live_online_min": {
    group: "live", type: "int", schema: int(0, 100000), default: 10,
    description: "Show \"designers online now\" on the home page only from this many online.",
  },
  "home.live_joined_min": {
    group: "live", type: "int", schema: int(0, 1000000), default: 20,
    description: "Show the live designers tag on the home page only from this many designers joined.",
  },
  // Owner, 2026-10-13: the originality agreement + ID photo before a designer's first design can be switched off
  // (Admin → Agreements). Off: designers send designs without it; agreements already signed stay as they are.
  "legal.agreement_required": {
    group: "legal", type: "bool", schema: z.boolean(), default: false,
    description: "Ask designers to sign the originality agreement (with an ID photo) before their first design.",
  },
  "legal.agreement_resign_since": {
    group: "legal", type: "string", schema: z.union([z.literal(""), z.string().datetime({ offset: true })]), default: "",
    description: "Set by Legal pages → Publish with \"Ask every designer to sign again\": agreements signed before this time must be signed again.",
  },
  "notice.on": {
    group: "notice", type: "bool", schema: z.boolean(), default: false,
    description: "Show the notice bar at the top of every page.",
  },
  "notice.text_en": {
    group: "notice", type: "string", schema: z.string().max(200), default: "",
    description: "Notice text in English (up to 200 characters).",
  },
  "notice.text_bn": {
    group: "notice", type: "string", schema: z.string().max(200), default: "",
    description: "Notice text in Bangla. Empty uses the English one.",
  },
  "notice.link": {
    group: "notice", type: "string",
    schema: z.string().max(300).refine((v) => v === "" || /^\/(?!\/)/.test(v) || /^https:\/\/[^\s]+$/.test(v), "Empty, a page on this site (/contests) or an https link"),
    default: "",
    description: "Optional link when the notice is clicked: a page on this site like /contests, or an https link.",
  },
  "notice.tone": {
    group: "notice", type: "string", schema: z.enum(["info", "warning", "offer"]), default: "info",
    description: "Notice colour: info (dark), warning (amber) or offer (red).",
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

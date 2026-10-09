# logocontest.bd — Build Blueprint

This file is the single source of truth for building logocontest.bd. Read it fully before writing code. Build one milestone at a time (section 16) and do not add features that are not listed here.

Items marked **[CONFIRM]** are proposed defaults the owner has not confirmed yet. Build them as admin-configurable settings so they can change without code edits.

---

## 1. Product summary

logocontest.bd is a Bangladesh-only, logo-only design contest platform. All money is in BDT (whole taka, stored as integers).

- A **client** fills in a brief, pays up front, and the contest goes live.
- **Designers** submit logo entries (1 to 8 mockup images each, 1000×1000 px; owner 2026-10-08). A designer may submit as many entries to a contest as they like.
- The client rates, comments, rejects, and finally picks one winner.
- The winner delivers source files within 3 days, or the win is cancelled and the client picks another entry. After the client approves the files (with a star rating and short feedback), the prize (minus the designer fee) lands in the designer's wallet and can be withdrawn.
- Clients and designers can never contact each other directly.

Marketing targets clients. Designers are expected to arrive on their own.

## 2. Locked business rules

| Rule | Value |
|---|---|
| Client service fee | 25% of the prize, added on top (prize 5,000 → client pays 6,250); 15% when the prize is above 30,000 (custom prizes) (owner, 2026-10-08; was 20%; both rates and the threshold are settings) |
| Designer fee | 15% (0–9 wins), 10% (10–49 wins), 5% (50+ wins) (owner, 2026-10-08; was 7% / 5% / 2%) |
| Refunds | None. All payments are non-refundable. One exception, which is not a money refund (owner, 2026-10-09): a proven copy claim on the winning design lets the client pick another design (§7.6) |
| Copy claim (owner, 2026-10-09) | Within `timers.copy_claim_days` (3) days of picking the winner, the client can claim the winning design is copied or breaks someone's copyright (§7.6). The winner's prize stays on hold for the same days |
| Entry visibility | Client chooses. Open is the default and free. Blind is a paid upgrade (only the client ever sees the entries, see §7.4) |
| Entries per designer | Unlimited. To answer client feedback, a designer submits a new entry |
| Late delivery | If the winner does not upload the final files within 3 days, the win is cancelled and the client picks another entry |
| Copy flags | Any designer can flag an entry as copied, with a reason, a similar-logo image and links. Admin upholds or dismisses |
| NID verification | Not verified. Owner, 2026-10-09: before their first design, every designer signs the originality agreement with their full name, mobile, address and an ID number (NID, passport or birth certificate), §9.6. The number is stored for legal follow-up, not checked |
| Funds | Platform holds the client's payment until handover is approved |
| Payout | Win → deliver files → client approves with a 1–5 star rating and feedback (max 120 words) → wallet credit once the copy-claim days are over and no claim is open (owner, 2026-10-09) → designer withdraws |
| AI | AI-generated logos are banned. AI-generated mockups/backgrounds are allowed |
| Reject | Client can reject any entry to keep the contest clean |
| Messaging | No direct messaging. Only a comment + reply thread on each entry |
| Copied logo | Permanent ban. A proven copy claim on a winning design: the admin talks with the designer and decides a correction, a fine or a ban (owner, 2026-10-09; §7.6) |
| Packages | Starter 3,000 / Growth 5,000 / Pro 8,000 / Premium 12,000 / Elite 15,000 / Custom (min 3,000, step 500) (owner, 2026-10-08; database keys economy, standard, pro, premium, elite, custom) |
| Contest number (owner, 2026-10-08) | Every contest gets a running number shown as "Contest #00001" (five digits, more when needed) on its page, cards, dashboard and manage page, so everyone sees how many contests have run. The number is given when the contest is published (payment confirmed), so unpaid drafts never leave gaps. Existing contests were numbered in the order they started |
| Contest length | Any whole number of days from 3 to 30 (owner, 2026-10-08; min, max and the quick-pick chips are settings) |

Fee tier timing: the rate is decided by the designer's count of completed wins at the moment the winner is selected, and stored on the handover so it cannot change later. So the 10th win is still charged 15%, the 11th is charged 10%, and from the 51st win the fee is 5%. (The client's price is fixed when they pay; the contest goes live only after payment.)

Paid extension (owner, 2026-10-07): a contest is never extended for free or automatically. While a contest is open, the client may buy an **Extension** add-on to add days to it; if they don't, it ends on time. Price: **৳500 per day added** (owner), so +3 days = ৳1,500. Lengths and the low-entry prompt are settings: 3, 5 or 7 days per extension; no limit on how many; the dashboard and the 24-hour notice prompt the client to extend when the contest has fewer than 5 active entries.

No-result rule (owner, 2026-10-07): the contest ends with **no result** when the client stays silent in either of these cases:

1. No winner is picked within 5 days of the contest ending (or within 3 days of a missed file deadline).
2. The winner submits the final files and the client neither approves nor requests a change within 5 days.

Then the prize is shared **equally per designer** (not per entry; ratings do not matter) among every designer with at least one active entry. Designers whose entries were all rejected or removed, and a winner who missed the file deadline, get no share. No final files are delivered, no copyright is transferred, and files already uploaded in case 2 are not released to the client. The contest page shows "No result". A share is not a win: `wins_count` does not change. See §7.5 for the money.

## 3. Roles

| Role | Can do |
|---|---|
| Guest | Browse contests, winners, designer profiles, start the wizard |
| Client | Create and pay for contests, rate, comment, reject, shortlist, pick winner, approve handover |
| Designer | Submit entries, reply to comments, deliver files, withdraw wallet balance |
| Admin | Everything in section 13 |

One account has one role. One mobile number and one email can each hold only one account.

## 4. Tech stack

- **App:** Next.js (App Router, TypeScript), server actions for every mutation
- **Database and auth:** Supabase (Postgres + Auth). Row-level security on every table as a second line of defence
- **Frontend:** React + Tailwind CSS, mobile-first (design for 360px width first)
- **Background jobs:** a scheduled job every 15 minutes (chosen in milestone 6)
- **Storage:** Supabase Storage (S3-compatible). Originals in a private bucket, previews (resized, no watermark — owner 2026-10-08) beside them
- **Images:** server-side resize with sharp; no watermark on designs (owner, 2026-10-08: logos stay clean)
- **Auth (owner, 2026-10-07):** sign up with a mobile number (Bangladesh format checked, no OTP), an email and a password. Log in with the mobile number or the email, plus the password. Right after sign-up the user gets a browser push notification ("Welcome", if they allow notifications when they press **Create account**) and an email with a 6-digit code; they type the code on the site to confirm the email. The account works straight away and a banner asks for the code until it is entered. Password reset is by an emailed link (owner, 2026-10-07). An unconfirmed email blocks nothing for clients (owner, 2026-10-07); for designers it is **[CONFIRM]** (proposal: can't withdraw until confirmed)
- **Payments:** behind a `PaymentGateway` interface with a `FakeGateway` for local/dev. Real driver: SSLCommerz (covers bKash and cards) is added in milestone 9
- **SMS:** behind an `SmsSender` interface with a log driver for dev
- **Live chat (owner, 2026-10-08):** behind a `LiveChat` choice in settings: `none` (dev, no chat script; the Help page says chat is being set up) and `tawk` (Tawk.to, free; the owner answers from the Tawk.to app). The Tawk.to property and widget IDs are admin settings. The chat script loads only on the Help page and only after the visitor taps **Start live chat**, so no third-party script or cookie runs before that
- **Image moderation (owner, 2026-10-08):** behind an `ImageModerator` interface. Every uploaded profile photo is checked on the server and refused when it is nude or sexual. Drivers: `log` (dev, allows and logs) and `google` (Google Cloud Vision SafeSearch: refuse when adult is LIKELY or VERY_LIKELY, or racy is VERY_LIKELY). Logo entries get the same check when they arrive (milestone 4)
- **Languages:** English default with a Bangla toggle. Use the en/bn message files from day one; never hard-code user-facing strings

## 5. Data model

All tables have `id`, `created_at`, `updated_at`. Money columns are unsigned integers in taka.

**users**: role (client/designer/admin), name, username (unique; designers choose it, clients get one generated from their name and can change it), mobile (unique), mobile_verified_at (stays empty while there is no OTP), email (unique, required for new accounts; was nullable), email_verified_at (set when the emailed code is entered), password, avatar_path, bio (designers, max 300), skills (text[], designers), tools (text[], designers), experience_years (designers, 0–60, nullable), business_name (clients), status (active/suspended/banned), strikes (int), flag_warnings (int, false flags; 3 = ban), wins_count (int, all completed wins, shown on the profile), counted_wins_count (int, wins that count toward fee tiers and the leaderboard, §7.2), locale (en/bn, for SMS and notifications). In Supabase, `auth.users` holds the password and `public.profiles` holds the rest

**designer_payout_methods**: user_id, type (bkash/bank), bkash_number, bank_name, branch, account_name, account_number, routing_number, is_default

Designers also get `rules_accepted_at` on users: when they ticked the Designer Rules at sign-up (D-01).

**designer_agreements** (owner, 2026-10-09, §9.6): designer_id (one per designer), full_name, mobile, address, id_type (nid/passport/birth_certificate), id_number, signature_name (the typed full name), version (of the agreement text), signed_at, signed_ip, user_agent. Only the server and admins read it; the ID number is shown masked (`••••••3456`) and an admin's "show full number" is written to `audit_logs`

**copy_claims** (owner, 2026-10-09, §7.6): contest_id, handover_id, entry_id, client_id, designer_id, note, evidence_urls (json, up to 5), status (open/upheld/rejected), outcome (correction/fine/ban, when upheld), fine_amount, admin_note, resolved_by, resolved_at. One open claim per handover

**contests**: client_id, slug, status, brand_name, logo_text, slogan, business_type, business_description, website_url, styles (json), style_sliders (json), colors (json, up to 5 hex), let_designers_choose_colors (bool), used_on (json), likes_text, dislikes_text, short_name, target_audience, deliverables (text[]: icon_only, short_logo, versions, app_icons), requirements (text[]: no_stock, home_mockup), requirements_note, package (economy/standard/premium/custom), prize_amount, service_fee_amount, upgrades_amount, total_amount, duration_days, is_blind, is_private, is_promoted, is_highlighted, is_urgent, is_nda, logo_scan, winner_is_public (bool, blind contests only, set by the client after completion), starts_at, ends_at, judging_ends_at, extensions_count (int), extension_days_total (int), winner_entry_id, completed_at

**contest_files**: contest_id, type (example/current_logo), path, original_name

**entries**: contest_id, designer_id, number (per-contest sequence), status (active/rejected/withdrawn/removed/winner/forfeited; forfeited = won but files not delivered in time), logo_story (optional, up to 600 chars; owner 2026-10-08), rating (1–5, nullable), is_shortlisted, reject_reason, reject_note, rejected_at, declarations (json), declared_ip, declared_at

**entry_images**: entry_id, position (0 = cover), original_path, preview_path, phash, duplicate_of_entry_id (nullable, a near-duplicate found on upload, for admins). No fixed slots (owner, 2026-10-08)

**entry_comments**: entry_id, user_id, body, is_hidden (bool, set by an admin), deleted_at — the comment box on each design (§10)

**contest_comments**: contest_id, user_id, body, is_hidden (bool, set by an admin), deleted_at — the public comment list on a contest (§10)

**contest_favorites**: user_id, contest_id, created_at — contests a designer saved (§10)

**handovers**: contest_id, entry_id, status (awaiting_files/submitted/revision_requested/approved/cancelled/no_result), fee_rate (locked when the winner is picked), credited_at (when the prize reached the wallet, §7.3), revision_count, fonts_note, agreement_accepted_at, due_at, approved_at, client_rating (1–5), client_feedback (max 120 words)

**handover_files**: handover_id, file_type (ai/eps/svg/pdf/png/jpg), path

**payments**: contest_id, client_id, purpose (contest/extension), extension_days (nullable), gateway, gateway_txn_id, amount, status (initiated/paid/failed), paid_at, raw_response (json)

**wallet_transactions**: designer_id, type (prize_credit/split_share/withdrawal/adjustment/bonus), amount (signed), contest_id (nullable), fee_rate, fee_amount, balance_after, note

**withdrawals**: designer_id, payout_method_id, amount, status (requested/paid/rejected), paid_txn_id, processed_by, processed_at

**logo_scans** (owner, 2026-10-08): entry_id, requested_by, driver, full_matches (json), partial_matches (json), similar_images (json), pages (json), created_at

**reports**: reporter_id (client or designer), entry_id, reason (copied/ai/trademark/contact_info/inappropriate/other; owner 2026-10-08), evidence_image_path (similar logo, optional), evidence_urls (json, optional, up to 5 links), note (up to 500 chars), status (open/upheld/dismissed/dismissed_false), resolved_by, resolved_at. One open report per person per design

**strikes**: user_id, reason, entry_id (nullable), contest_id (nullable), issued_by, issuer_role (client/admin), created_at

**notifications**: user_id, type, data (json), link, read_at, created_at

**push_subscriptions**: user_id, endpoint (unique), p256dh, auth, user_agent, last_used_at — one row per browser that allowed notifications

**email_verifications**: user_id, email, code hash, attempts, expires_at, used_at — the 6-digit confirm-your-email codes

**monthly_winners**: month (YYYY-MM, one row per month), entry_id (the winning design), designer_id, likes, status (proposed/confirmed), gift_status (awaiting_address/address_given/sent), ship_name, ship_phone, ship_address, address_at, sent_at, sent_note, proposed_at, confirmed_by, confirmed_at (owner, 2026-10-09; the older wins/prize_total/avg_rating/bonus_amount columns are unused)

**design_likes** (owner, 2026-10-09): entry_id, user_id (a designer), created_at; one per designer per design

**settings**: key, value (json) — every number in this document that an admin might change

**blocked_terms**: term, language, type (phone/email/social/link/custom)

**audit_logs**: admin_id, action, subject_type, subject_id, changes (json)

## 6. Contest lifecycle

```
draft → pending_payment → open → judging → winner_selected → handover → completed
                                    judging → no_result (client picked no winner, §2)
                                    handover → no_result (client silent 5 days after files, §2)
handover → judging (winner missed the 3-day file deadline; win cancelled)
handover/completed → judging (copy claim upheld with a fine or ban, §7.6)
any state → cancelled (admin only)
```

| Status | Meaning | Leaves when |
|---|---|---|
| draft | Wizard not finished or not paid | Client reaches payment |
| pending_payment | Checkout started | Gateway confirms payment |
| open | Live, accepting entries | `ends_at` passes (a paid extension moves `ends_at` later) |
| judging | No new entries; client decides | Winner picked, or 5 days pass (→ no_result) |
| winner_selected | Winner chosen | Handover record created (immediate) |
| handover | Designer uploads files, client reviews | Client approves (rating + feedback), or the client is silent 5 days after files are submitted (→ no_result), or the designer misses the upload deadline (→ judging) |
| completed | Wallet credited | — |
| no_result | Prize shared equally among designers (§2, §7.5) | — |

Timers (all in settings): duration 5/7/10 days (default 7); judging window 5 days; after a missed file deadline the client gets 3 days to pick again; designer must upload files within 3 days; the client must approve or request a change within 5 days of files being submitted, or the contest ends with no result (the 5 days restart each time files are re-submitted); max 2 revision requests.

Missed file deadline: the winning entry becomes `forfeited`, the handover `cancelled`, and the contest returns to `judging` for 3 days. The client picks another entry (the forfeited one cannot be picked again). If they do not, the contest ends with no result (§2). The designer gets no automatic strike; the client may give one (§10).

A scheduled command runs every 15 minutes to move contests between states and send reminders.

**How it runs (owner, 2026-10-08):** `/api/cron/lifecycle`, protected by `CRON_SECRET` (sent as `Authorization: Bearer …`), does everything that is due and is safe to run again: each step is one database function that checks the state first, and each reminder is recorded (`lifecycle_events`) so it is sent once. Any scheduler can call it every 15 minutes (Supabase `pg_cron` + `pg_net`, or the host's cron). Each run, in order:

1. **Ending soon** (`timers.ending_soon_notice_hours` before `ends_at`): one notice to the client (with **Extend** when there are fewer than `limits.low_entry_prompt_threshold` active designs). Owner, 2026-10-09: every active designer gets "ends in 12 hours" and "6 hours left, quickly submit your logo" (`timers.designer_ending_notice_hours`); if the job runs late, only the latest due notice goes out. New contests are announced to every designer the moment they go live (the job also announces any it finds unannounced).
2. **Open → judging** when `ends_at` has passed: `judging_ends_at = ends_at + timers.judging_window_days`; the client is told to pick a winner by then.
3. **Pick-a-winner reminders** on the judging days in `timers.judging_reminder_days` (1, 3, 5).
4. **Judging → no result** when `judging_ends_at` has passed with no winner (§2 case 1).
5. **Missed file deadline:** a handover still waiting for files after `due_at` → the entry is `forfeited`, the handover `cancelled`, the contest back to `judging` with `judging_ends_at = now + timers.repick_window_days`; the designer and the client are told. When the client asks for a change, the designer gets a new `due_at` (`timers.designer_file_upload_days`) for the revised files.
6. **Handover → no result** when the client neither approved nor asked for a change by `review_due_at` (§2 case 2); files already uploaded are not released.

7. **Release held prizes** (owner, 2026-10-09): an approved handover not yet credited, whose copy-claim days (§7.3) are over and with no open claim, is credited to the wallet and the designer is told.
8. **Lift suspensions** (2026-10-09): accounts suspended by strikes become active again when `suspended_until` has passed.
9. **Monthly Winner proposal** (owner, 2026-10-09): after a month ends, its most-liked winning design is stored as `proposed` for an admin to pick (§11).

If no designer qualifies for a share, the contest still ends as `no_result` but is marked for an admin to decide (`admin_review`).

## 7. Money

### 7.1 Client charge

```
fee_rate    = 0.15 if prize > 30,000 else 0.25      (owner, 2026-10-08)
service_fee = round(prize * fee_rate)
total       = prize + service_fee + upgrades_total
```

| Package | Prize | Fee | Total (no upgrades) |
|---|---|---|---|
| Starter | 3,000 | 750 | 3,750 |
| Growth | 5,000 | 1,250 | 6,250 |
| Pro | 8,000 | 2,000 | 10,000 |
| Premium | 12,000 | 3,000 | 15,000 |
| Elite | 15,000 | 3,750 | 18,750 |
| Custom 30,000 | 30,000 | 7,500 | 37,500 |
| Custom 35,000 | 35,000 | 5,250 | 40,250 |

Always show the client the full breakdown before payment.

### 7.2 Designer payout

```
rate   = 0.15 if wins_count < 10; 0.10 if wins_count < 50; else 0.05
fee    = round(prize * rate)
credit = prize - fee
```

`counted_wins_count` is read when the winner is picked, and the resulting rate is stored on the handover. Increment `wins_count` (and `counted_wins_count`, if the win counts) only when the contest reaches `completed`.

A win only counts toward the tier and the leaderboard when prize ≥ 3,000 and the contest had entries from at least 3 different designers. At most 2 wins from the same client count.

### 7.3 Wallet

- The wallet is a ledger. Never store a balance without a matching `wallet_transactions` row.
- Credit happens once, inside a database transaction, when the handover becomes approved (or, for a no-result contest, once per designer share, §7.5).
- **Copy-claim hold (owner, 2026-10-09):** a prize is credited only when the handover is approved **and** `timers.copy_claim_days` (3) days have passed since the winner was picked **and** no copy claim is open. Until then it shows as Pending with the date it becomes available. If the client approves after the hold is over, the credit is immediate; otherwise the lifecycle job credits it when the hold ends (`release_prize_credit`, sets `handovers.credited_at`). No-result shares are not held (no files change hands).
- Withdrawal: minimum 500; the request deducts the balance immediately. **Payout (owner, 2026-10-08): automatic for bKash** — behind a `PayoutGateway` interface with drivers `fake` (development: pays at once with a FAKE transaction ID, not allowed in production), `manual` (nothing is sent; the request waits for an admin) and `bkash` (bKash disbursement, switched on once the merchant payout credentials are set). Bank withdrawals, and any bKash payout that fails, wait in the admin's withdrawal queue: the admin pays by hand and records the transaction ID, or rejects with a reason. A rejected withdrawal returns the amount (an `adjustment` transaction).
- Balance = the latest `balance_after`; every change locks the designer's profile row first, so two requests can't spend the same money. Pending = what open handovers will pay (prize − fee) once approved.

### 7.4 Upgrades (prices in settings)

| Upgrade | Effect | Price |
|---|---|---|
| Blind | Only the client sees the entries; each designer sees only their own. Nobody else ever sees them, even after completion, except that after completion the client may choose to make the winning logo public, shown with the designer's name | 1,000 |
| Private | Login required to view the brief, `noindex`, hidden from winners gallery and designer portfolios | 1,000 |
| Promoted (shown as "Featured") | Flag for admin to post it on the Facebook page/group; shown first in lists | 1,000 |
| Highlight (owner, 2026-10-08) | The contest's card in lists gets a gold border and a "Highlighted" badge | 500 |
| Urgent (owner, 2026-10-08) | An "Urgent" badge on the contest's card and page, so designers look at it soon | 500 |
| NDA / Confidential (owner, 2026-10-08) | Includes everything Private does (Private is not charged on top), and designers must accept a confidentiality agreement before they can read the brief, see the designs or submit. Acceptances are stored (`nda_acceptances`) | 1,500 |
| Extension | Bought while the contest is open; adds 3, 5 or 7 days to `ends_at`. Can be bought more than once | 500 per day added |
| Logo Scan (owner, 2026-10-08) | Bought once per contest; the client can then scan any design in that contest as often as they like. The scan searches the web for the same or a visually similar image (behind a `LogoScanner` interface: `log` dev driver that searches nothing and says so; `google` driver = Google Cloud Vision Web Detection with the same API key as image moderation) and lists exact matches, partial matches, similar images and pages that show them. Results are stored per design (`logo_scans`) | 500 |

**Add-ons after launch (owner, 2026-10-08):** while a contest is open the client can buy Promoted (shown as "Featured"), Private, Blind, Extension and Logo Scan from the contest's manage page. Each is a separate payment (`purpose` = `addon` or `extension`) through the same gateway; a paid callback applies it in one transaction (`confirm_addon_payment`). Blind bought after designs arrived hides them from other people from then on. An add-on already on the contest can't be bought again (Extension can). Add-on payments count toward the client's total spent but don't change the contest's original total.

**Picking the winner early (owner, 2026-10-08):** the client may pick a winner while the contest is open or judging. Picking closes the contest at once: the entry becomes `winner`, the contest `winner_selected` (no more designs), and the winner's file deadline starts (handover, milestone 6).

### 7.5 No-result split

```
designers = distinct designers with ≥1 active entry (excluding a forfeited winner)
share     = floor(prize / count(designers))
leftover  = prize - share * count(designers)   → 1 taka each to the designers who entered first
fee       = round(share * rate)                 rate = each designer's normal tier (§7.2)
credit    = share - fee                         → one `split_share` wallet transaction per designer
```

Credits happen once, inside one database transaction (`finish_no_result` locks the contest and only runs while it is still judging or in handover). If no designer qualifies, an admin decides (the contest is marked `admin_review`). Eligible = designers with an `active` or `winner` entry, minus any designer whose entry was `forfeited` in this contest.

### 7.6 Copy claim on the winning design (owner, 2026-10-09)

- **Who and when:** the client, within `timers.copy_claim_days` (3) days of picking the winner, from the handover section of their contest page (**Report copied design**) or through support (an admin can file it for them). They describe the problem and add up to 5 links (the original logo, a stock page, etc.). One open claim per handover.
- **While open:** the prize is frozen (no credit, even after the hold days); the handover itself carries on. The designer and admins are told.
- **Rejected:** the claim is closed with the admin's note; the prize is credited as normal once the hold is over.
- **Upheld:** the admin talks with the designer and picks one outcome:
  - **Correction** (owner confirmed, 2026-10-09: the designer fixes the design and the client keeps that win): the win stays. The designer must send corrected files: the handover goes back to *change requested* with a new deadline (`timers.designer_file_upload_days`) and the admin's note; if the files were already approved, the approval and the win count are undone so the client approves again.
  - **Fine:** the win is cancelled and the client picks another design (`timers.repick_window_days`, as after a missed deadline). The designer's designs in this contest are removed, no prize is paid, and the fine (taka, at most the wallet balance) is taken as an `adjustment`.
  - **Ban:** as Fine without the money, and the designer's account is banned permanently.
  - If the files were already approved, the win counts are undone. If the client does not pick again in time, the contest ends with no result (§7.5) and the removed designer gets no share.
- This is not a money refund: the client's payment stays with the contest.
- **Payment errors** (owner confirmed, 2026-10-09): money taken twice by mistake, or taken without the contest going live, is checked with the payment provider and corrected. This is stated in the Payment & No-Refund Policy and is not a refund.

## 8. Client flow

### 8.1 Wizard (`/start`)

One question per screen, progress bar, Back/Next, autosave to the browser. Once the account exists (after step 10) the contest is saved on the server as a `draft`, so an unpaid contest can be finished later. No login is needed for steps 1–8.

1. Logo name: the business or brand name (required, 2–60 chars); optional short name / app name (up to 30 chars, owner 2026-10-08), logo text and slogan
2. Business type (dropdown) + short description (20–300 chars) + target audience (who the customers are, required, 10–300 chars, owner 2026-10-08)
3. Website or Facebook page link (optional, "I don't have one" checkbox)
4. Logo styles, multi-select with example images: Wordmark, Lettermark, Pictorial, Abstract, Emblem, Mascot, Bangla/Arabic calligraphy
5. Up to 5 colors with hex codes, or "Let designers choose"; "Logo will be used on": Facebook/Instagram, Website, Signboard, Packaging, Print, Merchandise, TV/Video; and **What you need** (owner, 2026-10-08). Always included and shown ticked: the main logo, and the files every winner delivers (AI, EPS, SVG, PDF, transparent PNG, JPG, §9). Extras the client can tick: icon only (for the app icon and favicon), short logo (icon + short name), colour, white and black versions, and app icon sizes (1024×1024 master, plus iOS and Android sizes). The winner must deliver the ticked extras at handover
6. **Requirements** (owner, 2026-10-08; the "what you like / don't like" text areas were removed the same day, so new contests save `likes_text` empty and older contests keep theirs). Always on and shown ticked: 100% original work with full copyright transferred to the client, and no AI-generated logos (§3). Requirements the client can tick: no stock images or AI-made images in the final design, and a mockup showing the app icon on a phone home screen. Plus "Other requirements" (optional, up to 500 chars; the contact filter runs on it)
7. Upload examples or current logo (optional, max 5 files, JPG/PNG/PDF, 5 MB each)
8. Package (Starter / Growth / Pro / Premium / Elite / Custom), duration (3–30 days), upgrades (Featured, Blind, Private, Logo Scan, Highlight, Urgent, NDA), live order summary
9. Mobile number and email (no OTP; both required and unique)
10. Password
11. Your name, then payment (bKash / card), with a checkbox accepting Terms and the no-refund policy

Success screen: "Congratulations, your logo contest is live", contest link, share button, button to dashboard.

A logged-in client uses **Create Contest** from the dashboard: steps 1–8, then 11. A contest is never published without a successful payment.

### 8.2 Client dashboard

- My contests with status, days left, entry count
- Contest view: entries grid; on each entry: 1–5 stars, comment, shortlist, **Reject**, **Pick winner**
- **Extend contest** (while open): choose days, see the price, pay; `ends_at` moves only after the payment is confirmed
- Rejected tab
- Handover view: download files, Request revision (max 2), or Approve. Approving requires a 1–5 star rating and feedback (max 120 words); only then is the designer paid
- Blind contests, after completion: a switch to make the winning logo public
- Payments list and total spent
- Profile: name, business name, photo, mobile, email, password, and **Total spent** (sum of paid payments). Total spent is also shown on the client's public profile (§8.4)

### 8.3 Reject

Reasons: Looks AI-generated / Looks copied / Doesn't match the brief / Low quality / Other (short note).

On reject: the entry disappears from the contest for everyone except the client's Rejected tab and the designer's own list; the designer is notified with the reason. Reasons "AI" and "copied" also create a report for admin. Strikes are never automatic; see §10 for who can give one. Only an admin can ban.

### 8.4 Client public profile (`/c/{username}`)

Shows only: photo, business name (or name if none), member since, **total spent** (sum of paid payments, including private contests), number of contests, and their non-private contests with status and prize. Completed contests show the winning logo (blind contests only if the client made it public). No contact details anywhere.

## 9. Designer flow

### 9.1 Signup

Full name, mobile (no OTP), email, password, bio, payout method (bKash number or bank details), username, acceptance of Designer Rules.

### 9.2 Submitting an entry

- Owner, 2026-10-08: **1 to 8 mockup images** per entry, no fixed slots; the first image is the cover. Every image is stored at **1000×1000 px**. Any image the designer picks is fitted into 1000×1000 automatically in the browser (owner, 2026-10-08: no crop tool and no "too small" error): the whole image is kept and centred, small images are scaled up, and the spare edges take the image's own background colour (white for transparent images). The server checks again: every stored image must be exactly 1000×1000.
- JPG/PNG/WebP, max 5 MB each
- No logo story (owner, 2026-10-08: removed from the form; the `logo_story` column stays empty)
- No limit on entries per designer per contest. When the client asks for changes in a comment, the designer answers by submitting a new entry
- On upload: store the original privately, generate a clean preview (max 1200 px, no watermark — owner 2026-10-08), compute a perceptual hash and flag near-duplicates of existing entries for admin

Required checkboxes (store with timestamp and IP):

1. I made this logo myself for this contest. It is not copied or traced from any other logo, template, or stock artwork.
2. This is a custom design for this brief, not a pre-made or resold logo.
3. It does not use any trademarked or famous-brand element.
4. No part of the logo was generated by AI. (AI is allowed only for mockup backgrounds.)
5. If I win, I will deliver AI, EPS, SVG, PDF, PNG and JPG files within 3 days.
6. I will not share or ask for any contact details.
7. I understand that a copied or AI-generated logo means removal and a permanent ban.

### 9.6 Originality agreement (owner, 2026-10-09)

Filled in once, before the designer's **first** design (the submit page sends them to `/dashboard/agreement` and back). Designers who joined before this rule sign it before their next design (owner confirmed, 2026-10-09). Fields: full name, mobile number (prefilled), address, ID type (NID, passport or birth certificate) and its number. NID: 10, 13 or 17 digits; birth certificate: 17 digits; passport: 6–9 letters and digits. Then the full declaration in English and Bangla: the designs are their own original work; if a copied design is found after winning, the platform may cancel the win, withhold or fine the prize, ban the account, and take legal action under the laws of Bangladesh; the details given are true. They sign by typing their full name (must match the name above) and ticking **I agree**; the server saves the date, time, IP address, browser and the agreement version. The designer can view (not edit) their signed agreement with the ID number masked; changes go through support. Admins see every agreement (A-13). The Privacy page says why the ID number is collected and who can see it.

### 9.3 Handover

The winner uploads AI, EPS, SVG, PDF, transparent PNG and JPG files plus font names, and accepts a copyright transfer agreement, within 3 days. All six file types are required before submitting. If the client ticked extras in the brief (icon only, short logo, colour/white/black versions, app icon sizes), the winner also adds them as extra files (up to 10; the six types or ZIP) (owner, 2026-10-08). Files are private: only the winner, the client and admins can open them. If the deadline passes, the win is cancelled (§6). When the client requests a revision, the designer uploads revised files. An admin can inspect the vector source if the entry was reported as AI.

### 9.4 Public profile (`/d/{username}`)

Shows only: name, bio, photo, badges, **portfolio details** (owner, 2026-10-08: years of experience, skills, tools — chosen from fixed lists plus one "other" of each, no contact details), win count, **total earned** (public: sum of `prize_credit`, `split_share` and `bonus` wallet transactions, after fees), winning logos, all submitted logos with their star ratings, a QR code and a copyable profile link. No contact details anywhere. Entries from private contests are never shown. Entries from blind contests are never shown, except the winning logo once the client has made it public. The win count shown is `wins_count` (all completed wins).

**Portfolio (owner, 2026-10-08):** the public profile is the designer's portfolio. Anyone can share its link or download it as a **PDF** (`/d/[username]/portfolio`, made on our server with pdf-lib): photo, name, username, bio, experience, skills, tools, wins and designs, up to 12 public contest designs with their contest names, the profile link and its QR code. The portfolio shows only designs submitted to contests on this site (no outside uploads). PDF text uses the Latin font, so a bio written in Bangla is left out of the PDF until a Bangla font is added.

### 9.5 Wallet page

Available balance, pending (won but not yet approved), current fee rate with progress to the next tier, withdraw form, transaction history.

## 10. Comments and the no-contact filter

- **Design comments (owner, 2026-10-08):** each entry has one comment box. Everyone who can see the entry can read it. The contest's own client and designers who have submitted to that contest can post (in a blind contest only the client and that entry's designer, since nobody else sees it). Same rules as contest comments: 500 characters (setting), the no-contact filter (no mobile numbers, email addresses or social names), authors can delete their own comments, admins can hide any.
- **Contest comments (owner, 2026-10-08):** every contest also has one public comment list (the **Comments** tab). Anyone who can see the contest can read it. Only the contest's own client and designers (signed in with a designer account; their username is shown) can post, for example "Nice designs, good job" or "Entry #12 looks copied from …". Up to 500 characters (setting), the no-contact filter applies, authors can delete their own comments and admins can hide any. Pointing out a copy here does not replace the formal **Report** flag (§9).
- **Saved contests (owner, 2026-10-08):** designers can save (heart) any contest they can see, from the list or the contest page, and find them again under **Saved contests** in their dashboard.
- Run the filter on comments, bios, logo stories, brief text and file names. Block the submission and show: "Contact details are not allowed."

The filter must catch:

- Bangladeshi mobile numbers (`01[3-9]` + 8 digits, `+880`), including digits split by spaces, dots or dashes
- Bangla digits (০–৯): normalize to Latin digits first
- Numbers spelled out in English, Bangla or Banglish (six or more number words in a row)
- Emails (`name@site.com`, "@gmail.com", "gmail dot com"), and social handles written as `@name`
- Links: http, www, web addresses (`.com`, `.bd`, …), m.me, wa.me, fb.com/… and facebook.com/…
- Platform names only when they are used to share a way to reach someone (owner, 2026-10-08: "who shop on Facebook" or "it looks like Instagram's logo" are fine): a platform (facebook, fb, whatsapp, imo, telegram, instagram, messenger, viber, skype, linkedin, behance, …) together with words like contact, message, inbox, knock, call, add, follow, my, ID, page, profile, number or link (in English, Bangla or Banglish), or right before a colon or a name
- Any term in `blocked_terms`

Ordinary numbers (ages like 25–40, prices, years) and the bare word "at" are never blocked.

Strikes: 1 = warning, 2 = 14-day suspension, 3 = permanent ban. A confirmed copied or AI logo is an immediate permanent ban. Every entry has a Report button.

Who gives strikes (never automatic):

- **Client:** may give a strike, with a reason, to a designer who entered their contest (for example, for missing the file deadline). It counts immediately. Only an admin can remove it.
- **Designer:** cannot give a strike directly. A copy flag (below) goes to the admin, who may uphold it with a strike or ban.
- **Admin:** may give a strike to anyone.

Copy flags from designers: any designer who can see an entry can flag it as copied. The flag needs a reason and may include an image of the similar logo and links to where it appears. It goes to the admin reports queue; the admin upholds it (copied = permanent ban, entry removed) or dismisses it.

False flags: if the admin finds that a flag was false, the person who flagged gets a warning (`flag_warnings`). 3 warnings = account banned. The flag form shows this rule in small text under the submit button.

## 11. Badges and monthly winner

- **Top Designer:** 10+ counted wins
- **Monthly Champion:** most counted wins in a calendar month; shows the month
- No "verified" badge (there is no NID check)

Monthly winner: ties are broken by total prize value, then by average rating of winning entries. The system proposes the winner on the 1st; an admin confirms; the prize is added to the wallet as a `bonus` transaction. Prize amount is a setting (default ৳5,000).

**Owner, 2026-10-09 (replaces the counted-wins champion above):**
- **Likes on winning designs:** every signed-in, active designer can like a winning design (a heart next to the stars), once per design, and take the like back; nobody can like their own design. Only winning designs anyone may see can be liked (completed public contests; never private or NDA; blind only when the client made the winner public). The like count shows to everyone.
- **Leaderboard** (`/leaderboard`, public) shows **winning designs**, not designers: **This month** (designs whose contest finished this month, Bangladesh time) and **All time**, ranked by likes, then the client's star rating, then who finished first. Each shows the logo, brand, designer and likes, with the like button. Below: past Monthly Winners. No counted-win note.
- **Monthly Winner = the best-liked winning design of the month.** A design competes in the month its contest finished; its likes keep counting until an admin picks the winner early the next month. The lifecycle job proposes the most-liked design after the month ends; on **A-08 Monthly winner** an admin picks the winner (the proposed design or another one) with a reason.
- **Prize: a gift box, no money** (the ৳5,000 wallet bonus is removed). The winner gets a notice and confirms the delivery details on `/dashboard/gift` (name, phone, address; prefilled from their originality agreement); admins see them on A-08 and mark the gift **Sent** (with a courier note); the winner is told. Profiles show the badge **Monthly Winner · [month year]**.
- Top Designer (10 counted wins) is unchanged.

## 12. Notifications

Channels: in-app for everything, plus SMS, email and browser push where marked. Browser push (Web Push) reaches every browser where the user allowed notifications; their subscriptions are kept in `push_subscriptions` (user, endpoint, keys) and removed when the browser says they are gone.

| Event | To | SMS/Email |
|---|---|---|
| Signed up: welcome | New user | Browser push |
| Confirm your email: 6-digit code (also on **Resend code**) | New user | Email |
| Password reset link | User | Email |
| Contest live / payment received | Client | Yes |
| New entry (batched every 3 hours) | Client | Email |
| Contest ends in 24 hours (offers **Extend** when entries are low) | Client | Email |
| New contest is live: "New logo contest: {brand}. Submit your logo and win {prize}" (owner, 2026-10-09) | Every active designer | Push |
| Contest ends in 12 hours and in 6 hours: "Quickly submit your logo" (owner, 2026-10-09; replaces the 24-hour designer notice; hours are the setting `timers.designer_ending_notice_hours`) | Every active designer | Push |
| Monthly Winner picked / gift sent (owner, 2026-10-09) | The winner; all designers hear who won | Push |
| Contest extended (new end date) | Client and entered designers | No |
| Pick-a-winner reminders (day 1, 3, 5) | Client | Yes |
| Strike received (with reason) | Designer | Yes |
| False-flag warning | Flagger | Yes |
| Rating given | Designer | No |
| Brief edited by the client (owner, 2026-10-08) | Designers who submitted to the contest | No |
| New design submitted (owner, 2026-10-08: in-app at once) | Client | No |
| Comment on a design | The contest's client and that design's designer (not the author) | No |
| Comment on the contest | The client and designers who submitted (not the author) | No |
| Design rejected (with reason) | Designer | No |
| Winner picked | The winner ("You won!") and the other designers ("A winner was picked") | No |

**Notification kinds (owner, 2026-10-09):** every notification belongs to one kind, shown with its own colour, icon and label in the bell and on `/notifications` (which can be filtered by kind). Designers: brief changed, rating, client feedback (the client's comment on their design), new contest, contest ending (every contest at 12h/6h; and "ended, the client is choosing" for contests they entered), winner, final files (reminder `timers.files_due_notice_hours`, 24, before the file deadline; change requests), logo received (the client approved, with their stars), money (prize released, shares, withdrawals), like (someone liked their winning logo), comment (someone else commented). Clients: new design, designer reply (the designer answered on a design), like (a designer liked their winning logo), plus contest ending, winner, final files and comments. Account & safety and Admin are kinds of their own.

**In-app notifications (owner, 2026-10-08):** a bell in the header with the unread count opens the latest ones; each one links to the place it is about; "Mark all as read"; `/notifications` lists them all. Stored in `notifications` (user_id, type, data json, link, read_at).
| New comment or reply | Other party | Email |
| Entry rejected (with reason) | Designer | No |
| You won | Designer | Yes |
| Files submitted / revision requested | Client / Designer | Yes |
| Wallet credited | Designer | Yes |
| No result: prize shared (with the amount) | Client and every designer who gets a share | Yes |
| Withdrawal paid | Designer | Yes |
| Strike, suspension or ban | User | Yes |
| Monthly Champion announced | All designers | Email |

## 13. Admin panel (`/admin`)

1. Dashboard: contests posted/paid/completed, total client payments, platform revenue, average entries per contest, wizard drop-off by step, pending withdrawals
2. Users: search, suspend, ban, strike history
3. Contests: view, edit brief, extend, cancel, force-award
4. Entries: flagged duplicates, remove entry
5. Reports queue (client reports and designer copy flags, with the evidence image and links next to the entry): uphold (with strike or ban), dismiss, or dismiss as false (gives the flagger a warning)
6. Payments: gateway records, reconcile
7. Withdrawals: mark paid with transaction ID, or reject
8. Settings: all fees, tier thresholds, package prices, upgrade prices, timers, limits, monthly prize
9. Blocked terms list with a test box
10. Monthly winner: review and confirm
11. Homepage: choose featured winning logos
12. Audit log of every money or settings change
**M8 decisions (owner, 2026-10-09):**
- **Cancel a contest (admin):** needs a reason; the contest becomes `cancelled` and disappears from public pages. **No refund**: the payment stays (no-refund policy); any money given back is done by hand outside the site. The client and designers who entered are told.
- **Wizard drop-off:** each wizard visit records the furthest step reached (`wizard_visits`: anonymous visit id, furthest step, started/updated time, contest id once a draft exists; no personal data). The dashboard shows how many visits reached each step in the chosen period.
- **Monthly winner** (item 10) is built with the leaderboard in milestone 10.
- **Strikes** are stored one per row (`strikes`) so the history shows who gave each and why; `profiles.strikes` is the count of active ones. 1 = warning, 2 = suspension for `timers.strike_suspension_days` (`profiles.suspended_until`; the lifecycle job lifts it), 3 = permanent ban. Removing a strike lowers the count but never lifts a ban by itself.
- **Admin pages** share a left sidebar (desktop-first, a menu on phones). Every money, settings, strike, ban, cancel, extend and force-award action asks for a short reason and is written to `audit_logs`.

13. Copy claims (owner, 2026-10-09, §7.6): open claims with the winning design, the client's note and links; Reject (with note) or Uphold with Correction / Fine (amount) / Ban
14. Designer agreements (owner, 2026-10-09, §9.6): list with name, ID type, masked number and signed date; **Show full number** is logged

### 13.1 Site content (milestone 12, owner 2026-10-09)

The owner controls the site's words, pictures, lists and links from the admin panel, without code. Everything stays in English and Bangla, and every change can be reset to the built-in default.

1. **Texts** (`/admin/texts`): every word on the site (home page, How it works, Help, footer, menu labels, SEO titles and descriptions, notifications, emails and SMS, wizard labels, everything else) grouped by page, with search. Each text shows the English and Bangla default; the admin types a new version, and **Reset** brings the default back. Placeholders such as `{phone}` must stay: a change that drops or adds one is refused. Stored in `site_texts` (key, locale, value); the texts in the code are the defaults.
2. **Lists** (`/admin/lists`): until a list is edited the built-in items show; **Reset to default** brings them back.
   - **Home Q&A** (also used on How it works): add, edit (en + bn), hide, reorder, delete. Answers may use the price placeholders the built-in answers use, such as `{fee}`.
   - **Header menu** (up to 6) and **footer links** (For clients / For designers / Legal columns): label en + bn and a link (a page on this site such as `/contests`, or an https link); add, hide, reorder, delete.
   - **Business types** (wizard, browse filter, winners filter): hide and reorder; rename in Texts. New types are not added here, because every contest stores its type and the filters depend on them; "Other" always stays.
   - **Colour choices** (wizard step 5 suggestions, up to 16): add, reorder, delete.
   - The How-it-works steps stay three per side (each has its own picture); their words are edited in Texts. Logo styles, "used on", deliverables and requirements keep their fixed items (they have example pictures and rules) but can be renamed in Texts.
3. **Legal pages** (`/admin/legal`): edit Terms, Privacy, Payment & No-Refund Policy, Designer Rules and the designer originality agreement, en + bn, as simple text (`## heading`, paragraphs, `- list item`, `{placeholders}`). Publishing sets a new version date. For the agreement, the option **Ask every designer to sign again** makes designers sign the new version before their next design.
4. **Pictures and brand** (`/admin/brand`): site logo, app icon/favicon, home hero picture and the default share picture (Facebook/Google), uploaded to a public `site` storage bucket (PNG, JPG, WebP or SVG for the logo; size-limited); support phone, support email and office address, used in the footer, Help page and legal pages.
5. **Notice bar** (in `/admin/brand`): on/off, en + bn text, optional link, colour (info, warning, offer); shown at the top of every page; a visitor can close it for the day.
6. Every save goes to `audit_logs`, and the change shows on the site at once (its cache is cleared on save).
7. Not content, so not here: prices, fees, timers and limits (they are in Settings), page layout and design, and the contest rules themselves.

Built in four steps: (a) Texts, notice bar, contact details; (b) pictures; (c) lists; (d) legal pages.

### 13.2 Admin panel 2.0 (milestone 13, owner 2026-10-09)

1. **Own panel:** the admin area has its own top bar and grouped sidebar (a drawer on phones), not the public header and footer. **View site** opens the site in a new tab; the public avatar menu has **Admin panel** for admins. Admins are never asked to confirm their email by code.
2. **Super admin and staff:** the owner's account is the **Super admin** and sees and does everything. Only the Super admin adds, edits or removes other admins (staff), from **Admins & roles**: name, mobile, email and a starting password, a title (for example "Manager", "Support"), and permissions. Start from a preset (**Manager**, **Support**, **Moderator**), then tick or untick each area's **View** and **Manage**. Areas: Dashboard & analytics, Live visitors, Contests, Designs, Reports, Copy claims, Users, Unpaid contests, Payments, Withdrawals, Agreements (ID numbers), Monthly winner, Support inbox, Messages to users, Site content (texts, lists, legal, brand, homepage, blocked terms), Settings, Audit log. A staff member only sees the menu items and buttons they are allowed; every page and every action checks the permission on the server. Staff can be switched off at once.
3. **Live visitors and analytics** (owner's choice: members by name, guests anonymous):
   - Every page view on the public site is recorded: an anonymous visitor id (a cookie), the signed-in user if any, the page, where they came from, device type and country (from the host). **No IP address is stored.** Admin pages are not recorded. Page views older than 180 days are deleted by the 15-minute job. The Privacy page says this.
   - **Live now:** who is on the site in the last 2 minutes: member name and role (linked to their profile) or "Guest", the page they are on, device, country, and how long ago; refreshes every 10 seconds.
   - **Analytics:** visitors and page views today / 7 / 30 days with a daily chart, top pages, where visitors come from, devices, new sign-ups, and the wizard drop-off.
   - **Activity feed:** the latest things people did: sign-ups, contests created and paid, designs sent, comments, winners picked, withdrawals asked.
4. **Unpaid contests:** clients who started a contest but did not pay (draft or waiting for payment): name, mobile, brand, how far they got, amount, last activity, with **Call** and **Send message**. Anonymous wizard drop-off stays on the dashboard.
5. **Support chat** (owner's choice: chat button on every page): signed-in clients and designers get a chat button in the corner of every page and a **Support** page; each user has one conversation with the support team. The admin **Support inbox** lists conversations (open / closed, newest first, unread counts), shows the user's details next to the chat, and staff can reply, close and reopen. New messages update every few seconds and send a bell and push notification to the other side. The no-contact filter does not apply to support chat.
6. **Messages to users** (owner's choice: notification + inbox): an admin can message **all designers**, **all clients**, **everyone**, or **one person** (from their profile or by mobile / username). Each message arrives as a bell + push notification and also appears in the user's support chat, so they can reply. Every message is logged in the audit log.

## 14. Public pages

**Header menu (exactly four items):** Browse Contests | How It Works | Call: 01712028511 | Log In

**Home page sections, in this order:**

1. Hero. Headline: "Many designers. Many ideas. One perfect logo." Sub-line: "Get your logo from Bangladesh's best designers." Button: **Get Started** → `/start`
2. Recent winning logos, three rows, then **Browse more** → `/contests`. Until real winners exist, show live contests instead. Never show invented numbers or fake winners.
3. How it works: (1) Tell us about your brand (2) Get designs and give feedback (3) Pick your winner and get your files
4. Why Logo Contest: many ideas for one price; pay in taka with bKash; original, human-made logos only; full ownership of the winning logo; your payment is held safely until you approve the files; plus a comparison with a freelancer and a design agency
5. Q&A
6. Footer: Terms, Privacy, Payment & No-Refund Policy, Designer Rules, Contact

Other pages: `/contests` (filters: open, judging, completed), `/contest/{slug}`, `/winners`, `/d/{username}`, `/c/{username}`, `/how-it-works`, `/designers` (designer landing + signup), `/faq`, legal pages.

**Legal pages (owner, 2026-10-09):** `/legal/terms`, `/legal/privacy`, `/legal/payment-refund`, `/legal/designer-rules`, in English and Bangla, each with a version date, linked from the footer, the wizard's payment checkbox, designer sign-up and the originality agreement. The texts are drafts written for this site; **a Bangladeshi lawyer must check them before launch** (§18), especially the legal-action clause.

## 15. Non-functional requirements

- Mobile-first; pages must work well on a slow 4G phone (compress images, lazy-load grids)
- All state changes and money movements go through service classes with tests, never directly from controllers
- Authorization via policy functions; a designer must never reach another designer's originals, and never see other entries in a blind contest
- Original files are served only through signed, expiring URLs
- Rate-limit OTP, login, comments and uploads
- Verify payment gateway callbacks server-side before marking anything paid
- Feature tests are required for: fee calculation, tier changes at 10 and 50 wins, contest state transitions (including the missed file deadline and both no-result cases), the no-result split (equal shares, exclusions, rounding), wallet credit happening exactly once, the contact filter, blind-contest visibility

### 15.1 SEO and launch basics (milestone 11, 2026-10-09)

- **Site address:** `SITE_URL` (for example `https://logocontest.bd`) is the base for canonical links, the sitemap and share previews. A staging copy sets `SEO_NOINDEX=true` so search engines skip it.
- **Titles and descriptions:** every page has its own title (`Page · logocontest.bd`) and the public ones a description, in the visitor's language. Pages behind a login, admin pages, the wizard result and the auth pages are `noindex`.
- **Hidden from search:** private contests, NDA contests, contests not yet live, dashboards, admin, `/api`, `/dev`. They are left out of the sitemap too.
- **`/sitemap.xml`:** home, Browse, Design Studio, How It Works (both tabs), Help, designer sign-up, the four legal pages, every public live or finished contest and every active designer profile with at least one public design. **`/robots.txt`** points to it and blocks the private areas.
- **Canonical links** on contest pages (without `?tab=` / `?entry=`), designer profiles, Browse and the legal pages, so one address is indexed per page.
- **Share previews (Open Graph):** a site card for every page, and a contest card (brand name, prize in BDT, status) so links shared on Facebook and WhatsApp look right. Contests hidden from search get the site card only.
- **Structured data:** Organization and WebSite on the home page.
- **One address for both languages:** English and Bangla share each URL (the language is a cookie), so search engines index the English version; there are no separate language URLs for now.
- **Performance:** Bangla fonts load only the Bengali characters, and the Bangla display font loads only when used; images are lazy-loaded; a production build is checked for oversized pages.
- **Backups:** see §18.4.

## 16. Build milestones

Finish, test and commit each milestone before starting the next.

1. **Foundation:** Next.js + Supabase project, Tailwind layout, localization setup, settings table with seeded defaults, roles, mobile + OTP auth (log driver), basic admin login
2. **Contest wizard:** all 11 steps with autosave and drafts, `FakeGateway` payment, contest goes `open`, success screen
3. **Browse and contest pages:** `/contests`, contest detail, home page with live data
4. **Designer side:** signup, payout method, entry upload with slots, previews, declarations, blind/open visibility rules
5. **Client review:** ratings, shortlist, reject with reasons, comment threads, contact filter, report button, designer copy flags with evidence
6. **Lifecycle engine:** scheduler, judging, paid extension, pick winner, no-result when the client is silent
7. **Handover and wallet:** file delivery, missed-deadline cancellation, approval with rating and feedback, no-result split payout, fee tiers, wallet ledger, withdrawals
8. **Admin panel:** everything in section 13
9. **Real integrations:** payment gateway driver, SMS provider, email, S3 storage
10. **Profiles and gamification:** public designer profile with QR and total earned, public client profile with total spent, badges, leaderboard, monthly winner
11. **Launch polish:** Bangla translations, SEO basics (titles, sitemap, `noindex` for private contests), legal pages, performance pass, backups
12. **Site content (owner, 2026-10-09):** texts, lists, legal pages, pictures, contact details and a notice bar, all editable in the admin panel (section 13.1)
13. **Admin panel 2.0 (owner, 2026-10-09):** own admin layout, Super admin and staff permissions, live visitors and analytics, unpaid contests, support chat and messages to users (section 13.2)

## 17. Out of scope for now

Direct messaging, refunds, NID verification, international payments, design categories other than logos, hiring a designer one-to-one, mobile apps, featured/highlighted upgrades, second and third prizes.

## 18. Things the owner still needs to settle

1. All **[CONFIRM]** items are settled (owner, 2026-10-07): counted wins (prize ≥ 3,000, at least 3 designers, at most 2 wins per client); upgrades ৳1,000 each; Monthly Champion ৳5,000; payment gateway SSLCommerz. (Also settled: no free or automatic extension; extension price ৳500 per day, 3/5/7 days, prompt under 5 entries; the normal designer fee applies to no-result shares; entries per designer unlimited; fee rate locked at winner pick; no-result rule; 3-day re-pick after a missed deadline.)
2. SSLCommerz merchant account and its documents (needed for milestone 9)
3. Legal check with a CA/lawyer: holding client funds, tax on designer payouts, VAT on the service fee, and the wording of the no-refund policy. Owner, 2026-10-09: the lawyer also checks the four legal pages and the designer originality agreement (especially the legal-action clause and storing ID numbers) before launch
4. **Backups (2026-10-09):** the Supabase Free plan keeps no downloadable daily backups. Before launch, move the project to **Supabase Pro** (daily backups kept 7 days; point-in-time recovery is an extra). Until then, and as a second copy afterwards, `npm run backup:db` (a `pg_dump` of the database, needs `SUPABASE_DB_URL` in `.env.local`) and `npm run backup:files` (downloads the storage buckets) save to `backups/`, which is never committed. Keep a copy off this computer.

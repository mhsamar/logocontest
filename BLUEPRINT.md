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
| Client service fee | 25% of the prize, added on top (prize 5,000 → client pays 6,250); 20% when the prize is above 50,000 (owner, 2026-10-22; was 15% above 30,000; both rates and the threshold are set on Admin › Pricing & fees) |
| Designer fee | 15% (0–9 wins), 10% (10–49 wins), 5% (50+ wins) (owner, 2026-10-08; was 7% / 5% / 2%) |
| Refunds | None. All payments are non-refundable. One exception, which is not a money refund (owner, 2026-10-09): a proven copy claim on the winning design lets the client pick another design (§7.6). One money exception (owner, 2026-10-21): the money-back guarantee, when fewer than 3 different designers take part (§7.10) |
| Copy claim (owner, 2026-10-09) | Within `timers.copy_claim_days` (3) days of picking the winner, the client can claim the winning design is copied or breaks someone's copyright (§7.6). The winner's prize stays on hold for the same days |
| Entry visibility | Client chooses. Open is the default and free. Blind is a paid upgrade (only the client ever sees the entries, see §7.4) |
| Entries per designer | Unlimited. To answer client feedback, a designer submits a new entry |
| Late delivery | If the winner does not upload the final files within 3 days, the win is cancelled and the client picks another entry |
| Copy flags | Any designer can flag an entry as copied, with a reason, a similar-logo image and links. Admin upholds or dismisses |
| NID verification | Not verified. Owner, 2026-10-09: before their first design, every designer signs the originality agreement with their full name, mobile, address and an ID number (NID, passport or birth certificate), §9.6. The number is stored for legal follow-up, not checked |
| Funds | Platform holds the client's payment until handover is approved |
| Payout | Win → deliver files → client approves with a 1–5 star rating and feedback (max 120 words) → wallet credit 3 days after the approval (owner, 2026-10-12; was counted from the winner pick) when no copy claim is open → designer withdraws to bKash (Personal or Agent) or a bank account; an admin pays and the designer gets a "Payment sent" card |
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

Timers (all in settings): duration 5/7/10 days (default 7); judging window 3 days (owner, 2026-10-12; was 5); after a missed file deadline the client gets 3 days to pick again; designer must upload files within 3 days; the client must approve or request a change within 5 days of files being submitted, or the contest ends with no result (the 5 days restart each time files are re-submitted); revision requests have no limit (owner, 2026-10-12: changes go on until the client approves).

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
9. **Monthly prizes safety net** (owner, 2026-10-11): the month itself closes at 23:59 on its last day (`/api/cron/month-close`, §11). On the 1st this step closes last month if that run was missed, and sends any reward a stopped run left unsent. (Replaces the likes-based Monthly Winner proposal.)

If no designer qualifies for a share, the contest still ends as `no_result` but is marked for an admin to decide (`admin_review`).

## 7. Money

### 7.1 Client charge

```
fee_rate    = 0.20 if prize > 50,000 else 0.25      (owner, 2026-10-22; was 0.15 above 30,000)
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
| Custom 50,000 | 50,000 | 12,500 | 62,500 |
| Custom 60,000 | 60,000 | 12,000 | 72,000 |

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

- **bKash number type (owner, 2026-10-15):** a bKash payout number is marked Personal or Agent (`designer_payout_methods.bkash_kind`), because the team sends money differently to each. Designers must choose at sign-up and in Profile › Payout method; the withdraw form asks too. Admin › Withdrawals and Admin › Users show it.
- The wallet is a ledger. Never store a balance without a matching `wallet_transactions` row.
- Credit happens once, inside a database transaction, when the handover becomes approved (or, for a no-result contest, once per designer share, §7.5).
- **After a contest (owner, 2026-10-12; migration 0039):**
  - The client has **3 days** to pick a winner after the contest ends (or picks early while it is open).
  - The winner must send the first final files within **24 hours** (`timers.files_strike_hours`), or is **suspended for 48 hours** (once per win; they can still send the files); the admins are told with the designer's phone number so they can call or message.
  - No first files within **3 days** (`timers.designer_file_upload_days`): the win is cancelled, the client picks again, and the designer is **banned for good**, even on a first offence. Only the first delivery has a deadline.
  - **Suspensions and bans: see §10 "Suspension and ban" (owner, 2026-10-12, replaces the strike rules).
  - **Delivery chat**: while the files are being delivered, the client and the winner write to each other on the handover (no phone numbers, emails or links); the client asks for changes as often as needed and the designer sends the files again until the client approves. Read-only afterwards.
  - The prize is held **3 days from the client's approval** (`timers.payout_hold_days`), and while a copy claim is open; then it reaches the wallet.
  - **Withdraw**: the amount (or Withdraw all) and the bKash number with **Personal or Agent** (or a saved bank account). The admins are told; they pay by hand and enter the transaction ID until a bKash payout account exists. When paid, the designer gets a notice and a **"Payment sent" picture card** (square and story) on the wallet page, private to them.
  - A **finished contest** (completed or no result) is read-only for its client too: everything can be seen and the files downloaded, nothing can be rated, liked, commented or changed.
- **Copy-claim hold (owner, 2026-10-09):** a prize is credited only when the handover is approved **and** `timers.copy_claim_days` (3) days have passed since the winner was picked **and** no copy claim is open. Until then it shows as Pending with the date it becomes available. If the client approves after the hold is over, the credit is immediate; otherwise the lifecycle job credits it when the hold ends (`release_prize_credit`, sets `handovers.credited_at`). No-result shares are not held (no files change hands).
- Withdrawal: minimum 500; the request deducts the balance immediately. **Payout (owner, 2026-10-08): automatic for bKash** — behind a `PayoutGateway` interface with drivers `fake` (development: pays at once with a FAKE transaction ID, not allowed in production), `manual` (nothing is sent; the request waits for an admin) and `bkash` (bKash disbursement, switched on once the merchant payout credentials are set). Bank withdrawals, and any bKash payout that fails, wait in the admin's withdrawal queue: the admin pays by hand and records the transaction ID, or rejects with a reason. A rejected withdrawal returns the amount (an `adjustment` transaction).
  - **Automatic withdrawals switch (owner, 2026-10-15):** Admin › Withdrawals has an **Automatic withdrawals (bKash)** card with an on/off switch (setting `payouts.auto_bkash`, off). It stays locked ("Waiting for the bKash payout API") until the payout API is connected: the five `BKASH_PAYOUT_*` keys in the server env, the sending code in `BkashPayouts`, and `CONNECTED = true` in `src/lib/payouts/ready.ts`. When on, bKash withdrawals are sent at once; bank withdrawals and failed bKash payouts wait for an admin. Switching is audited (`payouts.auto_on` / `payouts.auto_off`).
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
| AI copyright checker (owner, 2026-10-10; replaces Logo Scan, see §7.7) | AI logo checks, each ending in a Logo Research Certificate. **Free with 20 checks when the prize is ৳5,000 or more**; below that this add-on gives **10 checks** (owner, 2026-10-13; was 3 checks, free from ৳8,000, ৳500). Same add-on key (`logo_scan`), contest flag and price setting as the old Logo Scan, so contests that bought Logo Scan get the checker | 250 |

**Free add-ons from a ৳25,000 prize (owner, 2026-10-22):** with a prize of `upgrades.all_free_from` (25,000) or more, every add-on (Featured, Blind, Private, Highlight, Urgent, NDA) costs nothing, when starting the contest and when added later on the contest page (switched on at once, no payment). Extra days are still paid. The wizard's prize step and its review-and-pay step, the service wizard and the contest's add-ons panel say so. 0 = never free.

**Add-ons after launch (owner, 2026-10-08):** while a contest is open the client can buy Promoted (shown as "Featured"), Private, Blind, Extension and the AI copyright checker from the contest's manage page (the checker also while the contest is judging, owner 2026-10-10). Each is a separate payment (`purpose` = `addon` or `extension`) through the same gateway; a paid callback applies it in one transaction (`confirm_addon_payment`). Blind bought after designs arrived hides them from other people from then on. An add-on already on the contest can't be bought again (Extension can). Add-on payments count toward the client's total spent but don't change the contest's original total.

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

**Pictures (owner, 2026-10-10):** besides links, the client can add up to 3 screenshots or photos that show the copy (drag in, choose, or camera). They are saved as JPEG in the private `claim-files` bucket; admins see them on the Copy claims page.
- **While open:** the prize is frozen (no credit, even after the hold days); the handover itself carries on. The designer and admins are told.
- **Rejected:** the claim is closed with the admin's note; the prize is credited as normal once the hold is over.
- **Upheld:** the admin talks with the designer and picks one outcome:
  - **Correction** (owner confirmed, 2026-10-09: the designer fixes the design and the client keeps that win): the win stays. The designer must send corrected files: the handover goes back to *change requested* with a new deadline (`timers.designer_file_upload_days`) and the admin's note; if the files were already approved, the approval and the win count are undone so the client approves again.
  - **Fine:** the win is cancelled and the client picks another design (`timers.repick_window_days`, as after a missed deadline). The designer's designs in this contest are removed, no prize is paid, and the fine (taka, at most the wallet balance) is taken as an `adjustment`.
  - **Ban:** as Fine without the money, and the designer's account is banned permanently.
  - If the files were already approved, the win counts are undone. If the client does not pick again in time, the contest ends with no result (§7.5) and the removed designer gets no share.
- This is not a money refund: the client's payment stays with the contest.
- **Payment errors** (owner confirmed, 2026-10-09): money taken twice by mistake, or taken without the contest going live, is checked with the payment provider and corrected. This is stated in the Payment & No-Refund Policy and is not a refund.

### 7.7 AI copyright checker (owner, 2026-10-10)

Full spec: `Design/copyright-checker/COPYRIGHT-CHECKER-HANDOFF.md` and the five designs next to it. Decisions:

1. Only the contest's client uses it, while the contest is open or judging (owner, 2026-10-11: and after a winner is picked, while the winner is selected or the files are being handed over, so the client can check the winning design from the "You picked a winner" pop-up; the add-on can be bought then too). **20 checks per contest when free, 10 with the paid add-on** (owner, 2026-10-13; one logo image each), enforced on the server and in the database; a check that fails for a technical reason doesn't count.
2. **Free** when the prize is **৳5,000 or more** (20 checks); below that it is the **৳250 add-on** (10 checks) (owner, 2026-10-13: replaces ৳8,000 / ৳500 / 3 checks; migration 0043). It **replaces the Logo Scan add-on**: same add-on key, contest flag and price setting; the old per-design scan panel is removed (stored `logo_scans` rows are kept). Price, free limit, free checks (`limits.logo_checks_per_contest`), paid checks (`limits.logo_checks_paid`) and the close / high-risk similarity limits (45 / 85) are in Settings. A public page, **/logo-checker** (owner, 2026-10-13), explains the checker with sample data only and is in the main menu (with a NEW pill until 2026-11-12) and the footer.
3. **Search (owner's choice, 2026-10-10): real Google Lens results through SearchAPI.io** (`google_lens` engine, visual and exact matches) **plus Google Cloud Vision Web Detection** for exact copies, plus designs from other contests on logocontest.bd (image fingerprint, never private contests or blind contests that are still running). The AI reads the logo, compares shapes and writes the scores and advice: **Google AI Studio (Gemini)** when `GEMINI_API_KEY` is set (owner, 2026-10-12), else Claude (`ANTHROPIC_API_KEY`). "How we checked" and the certificate name only the searches that really ran.
4. Runs as a background job in steps; the browser polls. Found images are copied into our private storage at check time.
5. Every check ends in a **Logo Research Certificate** (PDF and PNG from one HTML template, rendered with headless Chrome), number `CC-0001`, with a public `/verify/CC-…` page (number, date, checked logo, result only). Never "copyright certificate", "copyright free" or "guaranteed".
6. Client page **My logo checks**; admin page **Copyright checker** with a view-only permission area in Admins & roles. The admin "Make a ticket" button stays hidden until Tickets exist.

### 7.8 Logo Image Checker policy and cost report (owner, 2026-10-14; migration `0049_checker_free_and_invites`)

- **Free on every logo contest:** the ৳500 add-on is gone (no longer in the wizard, the add-ons panel or the server; an older draft that had it ticked is not charged). Each logo contest gets **10 checks, whatever the prize** (owner, 2026-10-29; before: 15 for each full ৳1,000 of prize), for that contest only; a contest that bought the old add-on keeps at least the checks it paid for. The number is in Settings › Limits. When all checks are used, no new check can start.
- **Logo contests only:** thumbnails, social posts, Facebook covers, YouTube banners, Twitter headers, business cards, flyers and T-shirts can't use it (refused on the server too).
- **Used and left** show on My contests (every logo contest that can still be checked) and in the checker box on the contest's manage page.
- **Cost report** (Admin › Copyright checker › Cost report): every check with who asked (name and ID, client or designer), contest (name and ID), time, result and API cost in taka; totals per contest and per month; CSV download. The API prices (Google Lens per 1,000 searches, Cloud Vision per 1,000 images, AI per million input / output tokens, in US cents) and the taka rate are in Settings › Logo checker costs; each check keeps its cost in USD and taka at the rate of the day it ran (older checks are shown at today's rate, marked).

### 7.9 Payment methods, manual bKash, promo codes and Stripe (owner, 2026-10-14; migration `0050_manual_payments_promos`)

- **Methods (Admin › Payments › Methods):** bKash Personal (+8801677713493) and bKash Merchant (+8801712028511) are manual; the bKash API, SSLCommerz and Stripe are automatic. Each has its own on/off switch; an automatic one can only be switched on once its keys are on the server. Used for everything that is paid: contests, add-ons and extensions, and Pro. **Bangla QR** (owner, 2026-10-15; migration `0059_bangla_qr`): Bangladesh Bank's national QR, scanned with any bank or mobile banking app and verified automatically. Its API is not out yet, so it is listed off and locked ("Waiting for the Bangla QR API"). To connect it: the four `BANGLA_QR_*` keys in the server env, a gateway behind `PaymentGateway`, and `CONNECTED = true` in `src/lib/payments/bangla-qr.ts`; then the switch unlocks.
- **Manual bKash:** the payer sends money to the number and gives the transaction ID (required), their bKash number and a screenshot (both optional) on `/pay/{contest|addon|pro}/{id}`. They see "Your payment is successful. Your contest will be live soon. We will notify you." The contest stays "Waiting for approval" (dashboard, My contests, manage page) and the client can use their dashboard as usual. An admin approves in **Payments › Approvals**: the same steps as a paid gateway payment (contest live, add-on on, Pro on). Rejecting needs a reason; the payment stays open so the payer can send the right ID. A transaction ID can only be used once.
- **QA transaction IDs:** an admin makes test IDs ("QA" + 8 characters) in Payments › Approvals; a tester types one as the TrxID and the admin approves it. The proof is marked "QA test ID".
- **Promo codes (Payments › Promo codes):** random one-time codes (a batch, optional prefix) work once in total; a shared code works once per account (optional most uses, start and end). Client codes set the contest service fee to 20/15/10/5/0 %. Designer codes set the fee on the designer's next win to 15/10/5/0 % (added in Wallet) or take a percent off Pro. A code never raises a fee. It is kept for the person when they pay and counted as used when the payment is approved (or the win is picked); a client or Pro code from a checkout that was never paid comes back after 7 days.
- **Stripe and US dollars:** visitors from outside Bangladesh (Vercel's country of the connection) see prices in US dollars; anyone can switch ৳/$ in the footer. Bangla pages always show taka (owner, 2026-10-15), so the switch is on English pages only. Every amount is still kept in taka: dollars = taka ÷ `payments.usd_rate` (Settings › Dollar prices, 122) plus `payments.usd_markup_percent` (0) for card fees. Dollar visitors pay only with Stripe (card); taka visitors see the other methods. The dollars charged and the Stripe session are kept on the payment and must match exactly before it counts. The return page and the webhook both settle it; whichever comes first. Keys only in the server's environment: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. The designer's wallet, withdrawals and the admin stay in taka; withdrawals stay manual.
- **Monthly prizes are for Bangladesh only (owner, 2026-10-14):** visitors who see dollars see no smartphone or gift box offers, prize cards, pop-up offer, leaderboard page or leaderboard links (`visibleOffers()`); `/leaderboard` sends them to the home page. The month-close job and prize claims are unchanged.

### 7.10 Money-back guarantee (owner, 2026-10-21; migration `0069_money_back_guarantee`)

- **The promise:** if a contest ends with designs from fewer than `guarantee.min_designers` (3) **different designers**, its client can claim back **everything paid for that contest** (prize, service fee, upgrades, extensions, add-ons); the site absorbs the bKash and Stripe costs. A used promo code is not given back.
- **Who has it:** `contests.guarantee_designers` is stamped when the client goes to pay (draft → pending payment) or when the contest opens, only while `guarantee.enabled` is on. Turning the setting off never takes it from a contest that has it; the claim screens follow the stamp, the marketing and the wizard's terms line follow the setting.
- **Who counts:** designers with a design that is active, rejected, a winner or forfeited, plus a design the client rejected that its designer then took back. Held designs (the team's check) don't count when the client claims and must be decided before approval, when they count. Withdrawn and removed designs don't count. Test designers are left out only in a test client's contest. Counted again in SQL at approval.
- **When:** from the end until the pick-a-winner deadline (judging), and only if no winner was ever picked (any handover, even a cancelled one, ends it). Late case: a no-result end where nobody got a share (`admin_review`, no wallet line) can still be claimed for `guarantee.late_days` (30). One claim per contest. With enough designers counted, the client can instead ask the team to check the count (a reason of 20+ characters).
- **While a claim waits** the contest is frozen (no pick, no split, no cancel, no Trash) and the client's Pro chats close; the 15-minute job skips its reminders and its no-result split.
- **Decision (Admin › Money-back claims, permission "Money-back claims"):** approve (type the contest number; the Super admin may leave designers out of the count with a reason) → the contest is cancelled, nobody gets a prize or share, the client's designs are hidden from them. Reject (reason to the client) → at least `timers.repick_window_days` more days to pick. Blocked while designs are held, reports are open, a bKash proof waits, or money already went to a wallet.
- **Paying back:** by hand. bKash: one transfer to the client's number (suggested: the number they paid from), paste the TrxID. Stripe: refund in the Stripe dashboard, paste `re_…`. QA payments: no money. Only the person who pressed "I'm sending it" can mark it refunded (the lock doesn't run out; the Super admin can take it over), and the person who approved can't be that person (the Super admin can). The client hears at each step; the designers hear once the money is back. Within 7 working days of approval.
- **Elsewhere:** refunded contests leave the monthly client race, the client's "total spent", the admin money totals (in the period the money went back); Trash can't remove a contest or client with an open claim, and erasing a client keeps the claim without their number and note. Legal: Payment & Refund Policy, Terms, Designer Rules.

## 8. Client flow

### 8.1 Wizard (`/start`)

**8 steps (owner, 2026-10-15; migration `0062_brief_links`), replacing the 11 below:** 1 About you (real name, used to check payments, plus mobile, WhatsApp and email; the mobile and email are checked here; new clients only) · 2 Logo name, slogan, text on the logo, short name · 3 Business type ("Other" opens a box to type it), description, target audience · 4 Website & social links (Website / Facebook / Instagram / TikTok, up to 4, "I don't have one yet") and competitors ("I don't have one yet") · 5 Logo styles, the feel and colours · 6 Where the logo is used, extras, requirements (new tick-boxes: builds trust, simple, no extra decoration or effects, one strong idea, readable when small, works in one colour) and example files · 7 Prize, with the password for a new client (the account and the draft are made on Next) · 8 Review and pay. Signed-in clients see steps 2–8. Ready answers ("ideas") open from a button beside each field's label. Nothing a client writes is checked for contact details (§10). The drop-off chart counts steps 1–8, 9 = went to payment, 10 = paid.

One question per screen, progress bar, Back/Next, autosave to the browser. Once the account exists (after step 10) the contest is saved on the server as a `draft`, so an unpaid contest can be finished later. No login is needed for steps 1–8.

1. Logo name: the business or brand name (required, 2–60 chars); optional short name / app name (up to 30 chars, owner 2026-10-08), logo text and slogan
2. Business type (dropdown) + short description (20–300 chars) + target audience (who the customers are, required, 10–300 chars, owner 2026-10-08)
3. Website or Facebook page link (optional, "I don't have one" checkbox)
4. Logo styles, multi-select with example images: Wordmark, Lettermark, Pictorial, Abstract, Emblem, Mascot, Bangla/Arabic calligraphy
5. Up to 5 colors with hex codes, or "Let designers choose"; "Logo will be used on": Facebook/Instagram, Website, Signboard, Packaging, Print, Merchandise, TV/Video; and **What you need** (owner, 2026-10-08). Always included and shown ticked: the main logo, and the files every winner delivers (AI, EPS, SVG, PDF, transparent PNG, JPG, §9). Extras the client can tick: icon only (for the app icon and favicon), short logo (icon + short name), colour, white and black versions, and app icon sizes (1024×1024 master, plus iOS and Android sizes). The winner must deliver the ticked extras at handover
6. **Requirements** (owner, 2026-10-08; the "what you like / don't like" text areas were removed the same day, so new contests save `likes_text` empty and older contests keep theirs). Always on and shown ticked: 100% original work with full copyright transferred to the client, and no AI-generated logos (§3). Requirements the client can tick: no stock images or AI-made images in the final design, and a mockup showing the app icon on a phone home screen. Plus "Other requirements" (optional, up to 500 chars; the contact filter runs on it)
7. Upload examples or current logo (optional, max 5 files, JPG/PNG/PDF, 5 MB each)
8. Package (Starter / Growth / Pro / Premium / Elite / Custom), duration (3–30 days), upgrades (Featured, Blind, Private, AI copyright checker, Highlight, Urgent, NDA; the checker shows as included when the prize is at or over the free limit), live order summary
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
- Handover view: download files, Request revision (no limit, owner 2026-10-12; with the delivery chat), or Approve. Approving requires a 1–5 star rating and feedback (max 120 words); only then is the designer paid
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
5. My design has no nude, sexual or adult content. If it does, my account is banned permanently. (Owner, 2026-10-12.)
6. If I win, I will deliver AI, EPS, SVG, PDF, PNG and JPG files within 3 days.
7. I will not share or ask for any contact details.
8. I understand that a copied or AI-generated logo means removal and a permanent ban.

### 9.2.1 Design check (owner, 2026-10-15; migration `0061_design_check`)

- When a logo design is sent, the AI looks at small copies of its pictures (no brand name is sent). If any picture clearly isn't a design for the contest (an app or website screenshot, a chat, a document, a random photo or selfie, a meme, a blank or test picture), the design gets the status `held`: only its designer (badge "Waiting for approval") and the admin team see it, and the client is not told yet. The designer's other designs publish as usual.
- The team gets a bell and push ("Design waiting for approval") and decides in **Admin › Designs › To approve**: every picture is shown, the doubted ones outlined, with the AI's reason. **Approve and publish** makes it `active` (the client gets the usual "new design" notice, the designer "approved"); **Remove** works as for any design (reason; adult content bans).
- When unsure, the AI counts a picture as a design. If the check can't run (switched off, no AI key, an error, or no answer within 25 seconds) the design is published. Switch: Settings › Limits `designs.relevance_check` (on by default). Non-logo contest services are not checked yet.
- A held design counts toward the designer's design limit and can't win or share a no-result prize until it is approved.

### 9.6 Originality agreement (owner, 2026-10-09)

**Switch (owner, 2026-10-13):** Admin → Agreements has **Agreement before the first design**, **off** by default (setting `legal.agreement_required`): while it is off designers send designs without signing or adding an ID photo, and the submit page and the upload actions don't ask for it. Agreements already signed stay and can still be reviewed. Turning it on brings back everything below. Each change is in the Audit log, old → new.

Filled in once, before the designer's **first** design (the submit page sends them to `/dashboard/agreement` and back). Designers who joined before this rule sign it before their next design (owner confirmed, 2026-10-09). Fields: full name, mobile number (prefilled), address, ID type (NID, passport or birth certificate) and its number. NID: 10, 13 or 17 digits; birth certificate: 17 digits; passport: 6–9 letters and digits. Then the full declaration in English and Bangla: the designs are their own original work; if a copied design is found after winning, the platform may cancel the win, withhold or fine the prize, ban the account, and take legal action under the laws of Bangladesh; the details given are true. They sign by typing their full name (must match the name above) and ticking **I agree**; the server saves the date, time, IP address, browser and the agreement version. The designer can view (not edit) their signed agreement with the ID number masked; changes go through support. Admins see every agreement (A-13). The Privacy page says why the ID number is collected and who can see it.

**ID photo and address (owner, 2026-10-10):** the form asks for the address in parts (house / flat, road, area / thana / district, post code, and the country from a list of every country with Bangladesh first) and a photo of the ID: the photo page of a passport or birth certificate, or both sides of a national ID card. The designer can drag a photo in, choose one, or take one with the phone camera; the browser makes it small first and the server saves it as JPEG (dropping hidden data such as location) in the private `id-documents` bucket. Only admins with Agreements "manage" can open the photos, through a one-minute link, and every view is written to the audit log. Designers who signed before photos were asked for keep their agreement but add a photo before their next design (owner, 2026-10-11): the submit page sends them to a short "Add a photo of your ID" form, then back.

### 9.3 Handover

The winner uploads AI, EPS, SVG, PDF, transparent PNG and JPG files plus font names (owner, 2026-10-11: **AI and EPS are shared as Google Drive links**, "Anyone with the link can view", not uploaded, because they are big; the site accepts only https drive.google.com / docs.google.com links and checks they open without signing in; stored in `handover_files.link_url`), and accepts a copyright transfer agreement, within 3 days. All six file types are required before submitting. If the client ticked extras in the brief (icon only, short logo, colour/white/black versions, app icon sizes), the winner also adds them as extra files (up to 10; the six types or ZIP) (owner, 2026-10-08). Files are private: only the winner, the client and admins can open them. If the deadline passes, the win is cancelled (§6). When the client requests a revision, the designer uploads revised files. An admin can inspect the vector source if the entry was reported as AI.

### 9.4 Public profile (`/d/{username}`)

Shows only: name, bio, photo, badges, **portfolio details** (owner, 2026-10-08: years of experience, skills, tools — chosen from fixed lists plus one "other" of each, no contact details), win count (owner, 2026-10-12: **no money on the public profile**, total earned is no longer shown there; profile redesign in UI-JOURNEY P-06), winning logos, all submitted logos with their star ratings, a QR code and a copyable profile link. No contact details anywhere. Entries from private contests are never shown. Entries from blind contests are never shown, except the winning logo once the client has made it public. The win count shown is `wins_count` (all completed wins).

**Portfolio (owner, 2026-10-08):** the public profile is the designer's portfolio. Anyone can share its link or download it as a **PDF** (`/d/[username]/portfolio`, made on our server with pdf-lib): photo, name, username, bio, experience, skills, tools, wins and designs, up to 12 public contest designs with their contest names, the profile link and its QR code. The portfolio shows only designs submitted to contests on this site (no outside uploads). PDF text uses the Latin font, so a bio written in Bangla is left out of the PDF until a Bangla font is added.

### 9.5 Wallet page

Available balance, pending (won but not yet approved), current fee rate with progress to the next tier, withdraw form, transaction history.

### 9.7 Designer Pro plan (owner, 2026-10-13; `Design/pro/`, migration `0046_pro_plan`)

- **What it is:** a monthly plan for designers (default ৳500), set in **Admin › Pro plan** (`/admin/pro`, permission "Pro plan"). Everything (price, offer, free trial, promo code, limits, each feature) lives in the `pro_settings` row. **For sale** starts **off**: until the owner turns it on, nobody can buy Pro and `/pro` says "Pro opens soon".
- **Limits:** Basic designers send up to **5 designs per contest** and get **2 Logo Checker checks a month**; Pro is unlimited per contest (or the admin's number) with **20 checks a month** (owner, 2026-10-29; before: 100; the 3-day free trial 5), up to **50 portfolio uploads**. Clients may invite up to **10 Pro designers** per contest (a database trigger refuses the 11th). The month is the Bangladesh month. This replaces "entries per designer unlimited" in section 18.
- **Pro features:** early access to new contests (a head start in minutes; others see the contest after it), gold-ring Pro entries and Pro-first order, chat with the client **only inside a contest and only about the designer's own entries** (phone numbers, emails, links and payment details are warned about and logged, no hiring), client invitations, performance insights, priority support (Pro chats first in the support inbox), a weekly report and a public Pro page at `/designer/<username>` (Pro only; `/d/<username>` stays for everyone).
- **Payments and renewal:** through the site's payment gateway (`lib/payments`, SSLCommerz from milestone 9), with the callback signature checked. The gateway can't charge a saved wallet or card, so renewal is a reminder **7 days and 1 day** before the end with a one-tap pay link. A new price applies to new buyers at once and to members at their next renewal; members are told when it changes and again 7 days before.
- **Cancel / end:** cancel asks one short reason and keeps Pro until the end date; the 15-minute job then ends the plan and the designer goes back to Basic. Admins can give a free month, extend, change the end date or cancel; every change goes into the Pro activity log (CSV export).
- **Numbers:** every number on the Pro pages and Admin › Pro plan comes from real payments and activity; nothing is made up.

### 9.7.1 3-day free Pro Trial (owner, 2026-10-14; migration `0048_pro_trial`)

- **Who and how:** a designer who never had Pro or a trial taps **Start free trial** (Go Pro page or the floating card). One trial per account for life (one row per designer); existing designers can try it too. Admin › Pro plan has a **Free Pro Trial** switch, **off** until designers can pay ৳500 online; an admin can start, extend (+1 / +3 days) or end a trial for one designer at any time, even while the switch is off.
- **What it gives:** everything Pro gives (Pro dashboard, public Pro profile, highlighted entries and Pro-first order, client invitations, contest chat, insights, early access and instant alerts, priority support), with a **PRO TRIAL** badge instead of PRO. Two limits for the whole trial: **5 logo checks** (owner, 2026-10-29; before: 10) and **10 portfolio images** (Admin › Pro plan; trial length 3 days).
- **End:** on the last day the designer is told "Your Pro Trial is ending. Upgrade now to keep your Pro benefits active." (app and email). When the time is up, or when they end it themselves (Settings › Subscription › End trial), they are Basic again. Portfolio images are never deleted: they are hidden (the Pro profile is Pro-only) and show again after an upgrade. After a trial, Basic counts its 2 monthly checks from the end of the trial.
- **Upgrade:** paying ৳500 during or after the trial turns Pro on as usual and marks the trial **Upgraded**. Someone who had the trial is not a first-time buyer, so the older checkout "free trial days" (Offer section, set to 0) can't give a second free period; that field is no longer shown in Admin.
- **Admin › Pro plan › Pro Trials:** start and end dates, status (Active, Expired, Upgraded, Cancelled), logo checks and portfolio images used, the upgrade payment, the reminder history and every step (started, reminded, extended, cancelled, ended, upgraded), "Trial used · no new trial", and the numbers: on trial now, upgraded, ended without paying, trial → paid.

### 9.7.2 Pro invitations: Designer ID, accept / decline (owner, 2026-10-14)

- **Invite by Designer ID:** in the "Invite Pro designers" step the client can type a Pro designer's ID (their username) besides picking from the recommended list. The server checks that the ID belongs to an active designer whose Pro (plan or free trial) is active, before anything is sent; sending checks again.
- **Accept / decline:** the invited designer sees the brief (unless it is an NDA contest: then they sign it on the contest page), the prize, the deadline and the client's requirements on Pro › Contest invitations and on the dashboard, and accepts or declines (they can change their mind while the contest is open). Declined and removed invitations don't count toward the 10 per contest.
- **Not a hire:** an invitation is only to take part in the contest. It doesn't open a chat; the client can message the designer only after they send a design (as before).
- **Admin › Pro plan › Invitations:** every invitation with the contest, client, designer, the answer and its date, whether they took part (designs sent), filters and search, and **Remove** (the designer no longer sees it; kept in the Pro activity log).

### 9.7.2 Pro "Hide my design" (owner, 2026-10-14; migration `0053_pro_hidden_entries`)

- A Pro designer (trial included) can hide a design when sending it, or later from the design while the contest is open or being judged; showing it again is always allowed.
- Hidden: the contest's client and admins see it (with a "Hidden" badge); other designers and visitors see a locked card ("Hidden by a Pro designer · Public when the winner is picked"). Its pictures are never signed for them. It still counts in the design numbers.
- It is left out of public contest-card pictures, Design Studio and designer profiles until then. Once the winner is picked (the contest leaves open / judging) every design is public. A designer who is no longer Pro has their hidden designs shown again. Switch: Admin › Pro plan › "Hide my design".

### People's names (owner, 2026-10-14)

Client and designer names: letters only (English or Bangla, with their marks) and single spaces; no digits or signs like . / , (sign-up and Profile). A new client's name comes from the brand name without its digits and signs ("Client" when nothing is left).

### Accounts: real emails, confirmed email, right login page (owner, 2026-10-14)

- **Real emails only** (sign-up and Change email): made-up addresses are refused (too short for Gmail/Yahoo/Outlook, e.g. `de@gmail.com`; placeholders like `xyz@`, `test@`, `example.com`), common misspellings get "Did you mean …?", and **temporary inboxes** are refused: a built-in list of temp-mail sites, the domains in Admin › Settings › `auth.blocked_email_domains`, and any unknown domain that takes mail but has no website (how temp-mail domains like backyr.com look). `auth.allowed_email_domains` always lets a domain through. A DNS look-up that fails never blocks anyone.
- **Designers confirm their email before sending a design** (the submit page says so and links to Confirm my email; the server refuses too).
- **Logging in on the wrong page:** a client account on "Log in as a designer" (or the other way round) is told "This is a client account" and is not signed in, with a link to the right login page. Only after the password was right, so it never reveals which accounts exist.
- **Portfolio:** experience 0–20 years; up to 5 skills (the "other" skill counts).
- **Pro bought, waiting for approval:** no Go Pro card or Upgrade button; the Pro page says the payment is being checked and links to it, and Pro checkout opens that payment instead of a second one.
- Plain Save buttons in Settings are green; email and mobile fields show a red *.
- **Go Pro card** checks again on every page change: gone the moment the designer is Pro (or has paid and waits), without reloading the site.

### Uploads: any size, made light in the browser (owner, 2026-10-14)

No size limit for people to worry about: every picture is made light in the browser before it is sent (`src/lib/images/compress.ts`), long side brought down (screenshots 1600 px, pictures 2000 px, site pictures 2400 px), saved as WebP (JPEG where the storage place takes only JPEG), quality lowered only while the file is still above its target (about 350–900 KB). A picture that is already small is sent as it is. Used for payment screenshots, report evidence, brief pictures, Pro portfolio and chat pictures, the logo checkers, ID and claim photos and admin site pictures; design mockups were already fitted and made light. **Final design files (handover) are never changed.** PDFs keep their size limit. The MB settings stay as a safety net after compression.

**Mockups per design:** Admin › Settings, separately for Basic (`limits.entry_max_images`) and Pro (`limits.entry_max_images_pro`), 1–20 each (default 8). Client reference files: `limits.brief_max_files`.

### Trash: delete, restore, erase after 90 days (owner, 2026-10-14; migration `0054_trash_and_phone`)

- **Delete contest** (Contests · manage) and **Delete user** (Users · manage), each with a reason, move it to **Admin › Trash** (status `deleted`, the old status kept). From there it can be **restored** exactly as it was. After `trash.keep_days` (90) the lifecycle job **erases everything for good**: the rows, their payments and bKash proofs, and the stored files. **Erase now** is for the Super admin only. Every step is in the audit log.
- A contest still **unpaid `trash.unpaid_hours` (72) after it was started** goes to the Trash on its own, not while a bKash payment waits for approval.
- A deleted contest is gone for everyone except staff. A deleted account can't log in (also blocked at the login itself) and its public profile is gone; its designs stay in contests until the account is erased.
- A user can't be deleted while it still matters to others: a client with a live contest (open, judging, winner picked, handover), a designer with final files still to deliver, or with wallet money or a withdrawal waiting. Admin accounts are managed in Admins & roles.
- Erasing never takes prize money away from designers: their wallet lines only lose the link to the erased contest.

### Mobile numbers from any country, WhatsApp (owner, 2026-10-14; migration `0054_trash_and_phone`)

Sign-up (client wizard, service wizard, designer sign-up) and Profile › Mobile have a **country picker** (flag and code, Bangladesh first and the default). Numbers are kept as +<code><number>; Bangladesh numbers follow the strict Bangladesh rule. Log in with a foreign number by typing it with its code (+44…). bKash numbers stay Bangladesh only. **"This number is on WhatsApp"** is a switch at sign-up and in Profile; admins see it on the user page and the contest page's client panel. Numbers show as 01712-345678 for Bangladesh and +44 7911123456 for others.

### Ads (owner, 2026-10-14)

Admin › Settings › Ads: **on/off** and the **Google AdSense publisher ID** (ca-pub-…). When on, AdSense Auto ads load on public pages only (never the admin, dashboards, sign-up, checkout or payment pages) and `/ads.txt` is filled automatically. Off by default.

### Logins and devices (owner, 2026-10-14; migration `0055_login_sessions`)

- Every login is recorded once a minute while used: device (phone, tablet, computer), browser, system, IP address and place (city, country from the host). Kept 180 days after the login ends.
- **Device limits** (Settings › Logins and devices): clients and designers `security.max_devices` (3), staff `security.admin_max_devices` (2), the Super admin `security.super_admin_max_devices` (2; one device until 2026-10-22, migration `0071_no_idle_signout`). A new login beyond the limit signs the oldest out (the login itself is removed, so it stops working at once).
- **No other sign-out (owner, 2026-10-22):** nobody is signed out for not using the site or for closing it; only the device limit ends a login (and "Log in as" after its minutes). **Log out** ends that device's login only. The staff idle and closed-tab sign-outs can be switched back on: `security.admin_idle_minutes` (0 = never, the default; or 10–480 minutes without clicking, typing, scrolling or touching, with a warning a minute before; another tab in use keeps it alive) and `security.admin_close_tab_signout` (off by default; a few minutes after every tab is closed or the phone is locked). When on, the lifecycle job also signs such staff logins out if they never come back.
- The login pages say why someone was signed out.
- **Admin › Sign-ins & devices** (Audit · view): every login with device, place and status. **Admin › Staff activity** (Super admin only): each staff member's logins, the time they really worked and everything they did (the audit log). Both are tabs beside the Audit log.
- **User page:** Devices (sign out one or all), Password (send a reset email, or set a new one; never readable, never logged), and **Log in as this user** (Super admin only): the admin's own login ends, a bar says whose account it is with "Back to admin", it never counts toward the person's devices, ends after `security.impersonate_minutes` (60) and is in the audit log.

### Onboarding the owner controls (owner, 2026-10-14; migration `0056_onboarding_answers`)

**Admin › Onboarding** (Site content · view / manage), one tab for clients (the logo contest wizard) and one for designers (sign-up):
- Every question in step order. The ones the site needs (logo name, business type and description, mobile, email, password, package; name, username, payout, rules) are **Always**; the others can be **hidden** (client: short name, logo text, slogan, target audience, website, styles, colours, where it's used, what they need, requirements, the note, files, WhatsApp; designer: WhatsApp, bio). A wizard step whose questions are all hidden is skipped. Hidden questions are not checked anywhere (wizard, server, Edit brief).
- **Edit wording** of any question in English and Bangla: the same texts as Admin › Texts.
- **Your own questions** (up to 15 per flow; short or long text, one or several choices, link, colours; required or not; ready answers; up or down), each on the step the owner picks (client: the brief steps 1–7; designer: steps 1 and 3). Answers can't carry contact details. A client's answers are kept with the contest (`contests.extra_answers`): designers see them in the brief as "More from the client", admins on the contest page. A designer's answers are kept with the profile (`profiles.onboarding_answers`), shown on their admin user page. Kept as the settings rows `onboarding.client` / `onboarding.designer`; every save is in the audit log.
- Contest services other than logo keep their own questions in Admin › Services.

### 9.8 Logo check inside contests (owner, 2026-10-14; `Design/logo-check/`, migration `0047_logo_check_entries`)

- **Before sending:** Send opens Upload → Check → Send for the cover image. "Check originality" runs the existing Logo Checker on the exact uploaded file and uses one of the designer's monthly checks (Basic 2, Pro 20, the trial 5 for the whole trial, shared with their own Logo Checker checks; they start again on the 1st, Bangladesh time). The designer can skip ("Not checked"). High → "Upload a new version" or "Send anyway". Logo contests only.
- **Server only:** the server makes the SHA-256 fingerprint of the stored file and the score (the closest similarity found); the browser never sends a score. Levels come from Admin › Pro plan: Low 0–20 %, Medium up to 60 %, High above.
- **Badge:** automatic and locked. It shows only while the check is finished, was put on that entry by the server when it was sent, and has the same fingerprint as the entry's file; otherwise "Not checked". There is no way to replace an entry's file today; if one is added, the badge goes away by itself.
- **Report:** public ID `LC-XXXX-XXXX`, PDF (designer, client, admins), and `/verify/<reportId>` for anyone: summary only (no closest results; no picture or contest name for private, NDA or running blind contests), "File changed — report no longer applies" when the fingerprints differ. Closest results are a source name, a link and the similarity, never copies of other people's logos (no image copies are stored for these checks). Wording "AI research report, not a legal guarantee" on the panel, verify page, PDF and certificate.
- **High match:** goes to Admin › Copyright checker › High match entries to review (Keep / Remove entry; removing uses the usual "remove a design" step).
- **Client:** checking an entry whose file already has a report reuses it (no check used). Designers' checks never use up the client's contest checks. The client's Logo Research Certificate lists the designer's report ID and verify link while it applies.
- **Judging page:** sort Pro first (default; Pro entries newest first, then Basic) · Newest · Top rated · Lowest match (Low → Medium → High → Not checked); filters All · Checked · Not checked · Shortlisted · Not rated · Rejected; "n of m entries checked". The checker result never changes the default order.

## 10. Comments and the no-contact filter

**Owner, 2026-10-15:** the filter checks **designers only** (comments, bios, mockup names, delivery messages). Clients are never stopped for contact details, in the brief or anywhere else; their contest only goes live once paid. A domain name on its own ("Be Healthy.bd", "shop.com.au") is allowed; phone numbers, numbers written as words, emails, @handles, `http`/`www` links, links to a person's social or chat profile (facebook.com, instagram.com, t.me, wa.me…), "contact me on WhatsApp"-style phrases and the admin's blocked terms are still blocked.

- **Design comments (owner, 2026-10-08):** each entry has one comment box. Everyone who can see the entry can read it. Owner, 2026-10-11: only the contest's own client and **that design's own designer** can post. Other designers can't comment on someone else's design, in this contest or any other; they can like, dislike or report it. A client can comment only on designs in their own contest. Same rules as contest comments: 500 characters (setting), the no-contact filter (no mobile numbers, email addresses or social names), authors can delete their own comments, admins can hide any.
- **Contest comments (owner, 2026-10-08):** every contest also has one public comment list (the **Comments** tab). Anyone who can see the contest can read it. Only the contest's own client and designers who submitted a design to that contest (owner, 2026-10-11; their username is shown) can post, for example "Nice designs, good job" or "Entry #12 looks copied from …". Up to 500 characters (setting), the no-contact filter applies, authors can delete their own comments and admins can hide any. Pointing out a copy here does not replace the formal **Report** flag (§9).
- **Like and dislike on designs (owner, 2026-10-11):** every design has a like and a dislike count (`entry_votes`, one vote per person per design). Signed-in, active designers can vote on any other designer's design they can see, never their own; a client can vote only on designs in their own contest; admins don't vote. Everyone who can see the design sees the counts. Separate from the heart likes on winning designs (§11).
- **Sorting designs (owner, 2026-10-11):** the designs on a contest (public page and the client's manage page) can be sorted by **Top rated** (default: the winner first, then the client's stars, then likes, then newest), **Most liked**, **Most disliked**, **Most comments** and **Newest**.
- **Removing your own design (owner, 2026-10-11):** while the contest is open, a designer can remove their own design (uploaded by mistake, or they think it isn't good), after confirming. It becomes `withdrawn` (`entries.withdrawn_at`): hidden on the site for everyone, the client included, kept for admins; it no longer counts toward the designer's entries, the no-result split or the checker. A winning design can't be removed.
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

**Suspension and ban (owner, 2026-10-12; migration 0041; replaces the older strike rules).** A confirmed copied or AI logo is an immediate permanent ban. Every entry has a Report button.

- **Suspension = 48 hours** (`timers.suspension_hours`), then it ends on its own. The user gets a warning (notice and email, with the reason), and the profile and every page show it. While suspended they **can't send a new design, comment anywhere, or like/dislike**. Everything else still works: logging in, browsing, the final files and the files chat of a won contest, the wallet and withdrawals, saved contests, and a client's own contest work.
- **Who is suspended:** a winner with no first final files within 24 hours (automatic); a designer who shares or asks for contact details (phone, email, link, Facebook or other social names) or writes bad words in a comment (automatic: the comment is not posted and the designer is suspended at once; a client only sees the block); misuse found by an admin, such as a fake NID/passport/birth certificate (admin: Users → Suspend 48h, or a report upheld with a suspension).
- **Bad words** (English, Banglish, Bangla; whole words only): `src/lib/moderation/bad-words.ts`. Admins can add more under Blocked terms.
- **Permanent ban:** no final files within 3 days of winning; **3 suspensions within 30 days** (`timers.strike_expiry_days`, `limits.strikes_for_ban`); a nude or sexual design (the designer ticks "no nude, sexual or adult content" on every design; the image check also runs; admin: Remove design → "Nude or sexual design? Yes" bans); a nude or sexual contest (the client agrees to the content rules in a popup before making a contest; admin: Cancel contest → "Nude or sexual contest? Yes" removes it, keeps the payment with no refund, and bans the client). A banned user can't log in.
- Each suspension is one row in `strikes` (who gave it and why); `profiles.strikes` counts the ones in the last 30 days. Not counting one (admin) never lifts a ban or the current suspension; "Lift suspension" ends it early.
- There is no client strike any more.

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


**Owner, 2026-10-11 (replaces the 2026-10-09 likes rules above; `Design/rewards/REWARDS-HANDOFF.md`):** the likes-based Monthly Winner, the likes leaderboard, the admin pick, `/dashboard/gift` and the heart likes on winning designs are removed. The old tables stay unused.
- **The race:** every calendar month, from the 1st at 00:00 to the last day at 23:59, Asia/Dhaka time. Admins, staff and test accounts (`profiles.is_test`, switched in Admin → Users) never take part. Nor does anything in the Trash (owner, 2026-10-22): a contest moved to the Trash, its wins and designs, and accounts in the Trash don't count, and the past-winners strip and win cards leave them out.
- **Smartphone for clients:** the client who ran the most contests wins. A contest counts when it is paid and went live that month; a contest an admin cancelled does not count (there are no refunds); a contest that ended without a winner still counts. Equal: the bigger total prize money wins.
- **Mystery gift box for designers:** the designer who won the most contests that month (counted in the month the winner was picked). Equal: whoever earned more that month.
- **What the prizes are is never published:** the site says "a smartphone" and "a mystery gift box"; the owner chooses them by budget. The claim deadline is a setting, empty (and not shown) for now.
- **Closing the month:** a scheduled job at 23:59 Dhaka on the last day picks both winners, freezes their numbers, makes the two cards and sends them (in-app and email). Safe to run twice (`reward_months`). "Ask me first" holds everything for an admin's approval; "Close the month and send now" does the same by hand. Every close goes to the audit log. Nobody qualified: "No winner this month".
- **Claim (both prizes):** congratulation card on the profile and by email, then a form (full name, Bangladesh mobile, full address, "These details are correct"), then "Claim successful" with the claim ID (`RW-0001`) and three steps (claim received, we call to confirm, delivered). One claim per reward, read-only afterwards; changes go through support. Admins are told; unclaimed winners get a reminder. Claim details are private (server only; shown only in Admin → Monthly winner).
- **Claim, as built (2026-10-11):** `/dashboard/rewards/<id>` (UI-JOURNEY D-13 / C-24). The mobile is stored as 01XXXXXXXXX; the claim is saved by `claim_monthly_reward` (the winner only, once, only after the card was sent, refused after the claim deadline). Reminders: every `rewards.claim_reminder_days` (3) days, at most `rewards.claim_reminders_max` (3) times, until the deadline (migration 0036 adds both settings). Admins with Monthly winner get an in-app notice and an email without the claim details.
- **Contest win card:** made right after the client picks the winner (two images, 1080×1080 and 1080×1920: site logo, designer photo, winning logo, names), sent in-app and by email, shown on the dashboard, with download, phone share, Facebook and a public `/wins/<slug>` page. Always made; for blind, private and NDA contests the logo is blurred and labelled "Blind contest".
- **Leaderboard** (`/leaderboard`, public, cached a few minutes): this month's counts, top clients by contests (prize money shown, since it breaks ties), top designers by wins, month tabs and past winners. Names and photos only: never earnings, spending, phone numbers or addresses.
- **Home:** the AI copyright checker section replaces "Work with designers you can trust"; the two monthly prizes are their own section under the live contests (not in the hero), with an on/off in Admin → Home hero; the client and designer homes get a "this month" panel with their own number, the leader's number and days left.
- **Live designers tag (owner, 2026-10-11):** the home hero's top pill shows real "N designers online now" (seen in the last 5 minutes, `profiles.last_seen_at`, marked at most once a minute per signed-in user) and "M designers joined" (active designer accounts, no staff, test, suspended, banned or deleted accounts), with three designer photos. Hidden below 20 joined, online part hidden below 10 online; both limits in Settings (`home.live_joined_min`, `home.live_online_min`). Migration 0037.
- **How the close runs (2026-10-11):** a second `pg_cron` job (`logocontest-month-close`, `59 17 28-31 * *` UTC = 23:59 Dhaka on days 28–31) calls `/api/cron/month-close` with the same `CRON_SECRET`; it closes the month only on its real last day, from 23:55. If it is missed, the 15-minute job closes last month on the 1st (only on the 1st, so months before the prizes began are never closed). Each winner gets a `monthly_rewards` row (numbers frozen), a notice and an email linking to `/dashboard/rewards/<id>`, and two card pictures (1080×1080 and 1080×1920; red with a drawn phone for the client, gold with a drawn gift box for the designer; never a real phone model). Admins with Monthly winner are told (ready to approve / sent / no winner). The switches: smartphone card off or gift box card off = that prize is not given that month; "Ask me first" = held until an admin presses **Approve and send** (held cards are visible only to admins). By hand: **Close the month and send now** closes this month (or last month, if it wasn't closed) and always sends.
- **Admin → Monthly winner, as built (2026-10-11):** UI-JOURNEY A-08. Only admins with Monthly winner (view) see it and the claim details; the switches, the month close, approving, the claim steps, notes and reminders need Monthly winner (manage) and go to the audit log. The likes-era code is gone (likes, the admin pick, `/dashboard/gift`'s form); the winners gallery and the home logos list winning designs newest first; the "Monthly Winner" badge on a designer's profile now comes from the gift box months (`monthly_rewards`). The old tables (`monthly_winners`, `design_likes`) stay in the database, unused.
- **Test contests (owner, 2026-10-22):** a test client's contest works end to end for test accounts, who reach it by direct link, but never reaches real designers or the public. Its announcements, ending reminders, saved reminders and Pro invitations go to test designers only. It is left out of the public contests lists, featured and home lists, Design Studio, winners, the Pro dashboards' contest lists, the search-engine counts, Facebook cards (skipped as "test account") and Pinterest, and its public page has no share buttons. Test and real accounts never see each other in Pro invitations.
- **Testing:** a hidden test mode closes a test month counting only test accounts and sends nothing to real users. It is on Admin → Monthly winner (**Run a test close**, **Clear test results**); test winners do get their notices and emails, so only use test accounts.

## 12. Notifications

Channels: in-app for everything, plus SMS, email and browser push where marked. Browser push (Web Push) reaches every browser where the user allowed notifications; their subscriptions are kept in `push_subscriptions` (user, endpoint, keys) and removed when the browser says they are gone.

| Event | To | SMS/Email |
|---|---|---|
| Signed up: welcome | New user | Browser push |
| Confirm your email: 6-digit code (also on **Resend code**) | New user | Email |
| Password reset link | User | Email |
| Contest live / payment received | Client | Yes |
| New entry (bell at once; email at most once a day per contest, Admin › Notifications) | Client | Email |
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

### 12.1 Emails (owner, 2026-10-15; `Design/emails/`, migration `0057_email_log`)

Every email the site sends uses one of 14 designed templates (600px, tables, inline styles). `scripts/email-templates.mjs` turns `Design/emails/*.html` into `src/lib/email/templates.ts`; subjects and preview lines are in `src/lib/email/catalog.ts` (from `templates.json`). `render(key, data)` (`src/lib/email/render.ts`) fills `{{vars}}` (always HTML-escaped), keeps or drops `{{#if}}` parts, and makes the plain-text version from the same filled email. The designs are in English; the general `notification` email carries the text in the person's own language.

**Provider:** Resend (`EMAIL_DRIVER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`; server env only), from `no-reply@logocontest.bd`, reply-to `support@logocontest.bd` (`EMAIL_REPLY_TO`). `EMAIL_DRIVER=log` prints emails to the console instead.

| Template | Sent when | To |
|---|---|---|
| `otp` | Confirm-your-email code (sign-up, Resend code, changed email). 6 digits, 10 minutes, 5 tries, 60 s before a new one, at most 3 an hour per address and 10 per IP; the code is never in a link | The person |
| `welcome` | Account created (client wizard or designer sign-up) | The person |
| `contest-new` | A contest opens: Pro designers with email alerts on hear at once with the "Pro early access" note and their head start; every other active designer when it opens to all | Designers |
| `contest-invite` | A client's invitation reaches a Pro designer | Pro designer |
| `contest-ending` | At each designer ending notice (`timers.designer_ending_notice_hours`, 12 h and 6 h) | Designers who sent a design or saved the contest |
| `entry-shortlisted` | The client shortlists a design (once per design) | Designer |
| `contest-won` | A winner is picked (by the client or an admin): prize, the fee of their locked fee step, what they get | Winner |
| `client-new-entries` | Lifecycle job: new designs since the last one, at most once a day per contest | Client |
| `client-pick-winner` | The contest ends and judging starts | Client |
| `chat-message` | Pro messages, comments between the client and the designer on a design, the final-files chat; at most one email per conversation every 30 minutes | The other person |
| `logo-check-ready` | A logo check finishes (not the check a designer runs while sending a design) | Who ran it |
| `pro-receipt` | A Pro payment is received | Designer |
| `pro-renewal` | 7 days and 1 day before the Pro plan ends | Designer |
| `notification` | Everything else that emails: password reset, suspension/ban/reactivation, ID check, Pro trial and expiry, Pro weekly report, monthly prizes and claims, win cards | The person |

**Email settings:** people have no email settings page (owner, 2026-10-15): which designer emails go out is set per plan in Admin › Notifications ("Designer emails by plan", Basic and Pro, setting `notifications.designer_emails`; `sendEmail` skips them as `basic_off` / `pro_off`). `profiles.email_off` lists the emails a person stopped with an Unsubscribe link (and keeps what people turned off before). Every email except codes and security emails (password reset, suspension, ban, reactivation, ID check) has an Unsubscribe link for its own kind (`/email/unsubscribe`, signed with `OTP_SECRET`, asks before changing anything) and a one-click `List-Unsubscribe` header (`POST /api/email/unsubscribe`). Pro designers' Contests page has no email switch any more (owner, 2026-10-15); its design-type filter applies to app alerts only.

**Sending (`src/lib/email/send.ts`):** settings first, then the daily limit (Settings › Emails › `email.daily_limit`, 80: emails other than codes and security emails stop for the day at that number, so codes still go on Resend's 100-a-day free plan; 0 = no limit), then Resend with up to 3 retries (not when Resend refuses for good), and a row in `email_log` either way (user, template, what it was about, sent/failed/skipped and why, Resend's message id, tries).

**Pictures:** the logo is `/brand/logo-icon-tile.png`. A contest's picture is `/api/email/contest/<slug>` (a 320×240 PNG tile with the brand's first letter; the logo for private and NDA contests). A design's picture is `/api/email/image/<token>`: the token is signed and runs out after 120 days, only design previews can be asked for, and it is sent as a JPEG at most 1200 px wide. Logos found by the checker are never in an email.

### 12.2 Admin › Notifications (owner, 2026-10-15; `/admin/notifications`)

One page for every notice the site sends, in tabs by who gets it (designers, Pro designers, clients, everyone, admins). Each row (`src/lib/notifications/admin-catalog.ts`, one row per notice, covering one or more notification types) shows what it is, when it goes, and a switch for each way it goes: **bell** (in the site), **push** (browser) and **email**. Codes, password reset, suspension/ban, ID check and late-files suspensions are always on. Where a notice has a timing, it is edited on the row:

| Timing | Setting | At first |
|---|---|---|
| Designers: contest ending | `timers.designer_ending_notice_hours` | 12, 6 hours before the end |
| Client: contest ends soon | `timers.ending_soon_notice_hours` | 24 hours before |
| Pick-a-winner reminders | `timers.judging_reminder_days` | judging days 1, 3, 5 |
| Send your final files | `timers.files_due_notice_hours` | 24 hours before the deadline |
| Late files suspension (the rule itself) | `timers.files_strike_hours` | 24 hours after winning |
| Prize in wallet (the hold itself) | `timers.payout_hold_days` | 3 days after approval |
| New-designs email to the client | `timers.new_entry_digest_hours` | at most once in 24 hours per contest |
| Monthly prize claim reminders | `rewards.claim_reminder_days`, `rewards.claim_reminders_max` | every 3 days, at most 3 |
| Chat emails | `notify.chat_email_minutes` | at most one per chat in 30 minutes |
| Pro: saved contest ends soon | `notify.saved_reminder_hours` | 24, 2 hours before |
| Pro: invited contest ends soon | `notify.invite_reminder_hours` | 24 hours before |
| Pro renewal | `notify.pro_renewal_days` | 7, 1 days before |
| Upgrade reminder (clicked Upgrade, didn't pay) | `notify.upgrade_reminder_hours` | 1, 72 hours after |

Pro early access (how long Pro designers hear first) and the upgrade reminder's on/off stay in Admin › Pro plan; the rows link there. The switches are kept in the setting `notifications.channels` (row → ways turned off). `notify()` checks the bell, `notifyWithPush`/`broadcastToDesigners` check push, and `sendEmail` checks the email (skipped as `admin_off` in `email_log`). A person's Unsubscribe choices and the designer plan switches apply on top. Saving needs a reason and is written to the audit log (`update_notifications`). Needs `settings.view` to see and `settings.manage` to change.

**Money waiting for the team (owner, 2026-10-22):** a bKash payment proof to approve and a withdrawal to pay (row `admin_payments`) reach every admin who can act on them (`payments.manage`, `withdrawals.manage`) as a bell, a browser push and an email in their own language (the payment email gives the amount, what it is for and the transaction ID); staff who may only look (`.view`) get the bell. Admins turn push on per device in the account menu (**Phone notifications**: Turn on, Send a test to this device, Turn on again). On iPhone and iPad web push needs the site on the Home Screen, so the admin pages link a web app manifest (`/admin-app.webmanifest`, start page `/admin`); public pages have none. **Designers and clients (owner, 2026-10-22)** turn push on the same way per device in Settings › **Phone notifications** (designers also from a dashboard card); the designer dashboard and the client workspace have their own manifests (`/designer-app.webmanifest`, `/client-app.webmanifest`). They get the rows with push: designers new and ending contests, Pro notices; clients payments; everyone support replies. **Log out** stops that browser's notifications (every logout form sends the browser's push endpoint and its row is removed). A browser's notifications move to another account only when that person presses Turn on (sign-up never takes them from another account), and "Log in as" never changes them.

### 12.3 Site text check (owner, 2026-10-15)

Every public text was checked against how the site works now and fixed in English and Bangla: the logo checker is for clients (every logo contest, from opening until the files are delivered) and designers (their own logos: Basic and Pro checks a month, from Admin › Pro plan); Basic designers send a set number of designs per contest, Pro without limit (`designsRule`, `designsShort` from Admin › Pro plan); taka payments are bKash (send money and the transaction ID) and cards only in US dollars from abroad; Pro designers can chat with clients; the prize reaches the wallet `hold` days after approval; reminder times and deadlines come from Settings, not typed into the text. The contest wizard's style examples are our own drawings (no other companies' logos; `public/style-examples/` removed), and the logo checker's samples are called "wave", not "swoosh". The legal pages (version 2026-10-15) cover the logo checker, the Pro plan, the AI support assistant, unpaid contests (`{unpaidHours}`), the trash (`{trashDays}`), login records, the services in use (Vercel, Supabase, bKash, Stripe, Resend, Google, SearchAPI) and Google AdSense cookies when ads are on.

## 13. Admin panel (`/admin`)

1. Dashboard: contests posted/paid/completed, total client payments, platform revenue, average entries per contest, wizard drop-off by step, pending withdrawals
2. Users: search, suspend, ban, strike history; profile state and reminders (owner, 2026-10-22: email verified, photo, designer profile completeness; Remind to verify email / add a photo / complete profile by bell, push and email, once a day per kind, notice row `profile_reminders`, audit `remind_user`; the designer agreement shows as missing only while `legal.agreement_required` is on)
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
- **Suspensions** are stored one per row (`strikes`) so the history shows who gave each and why; `profiles.strikes` is the count in the last 30 days. Each one suspends for 48 hours (`profiles.suspended_until`; the lifecycle job lifts it, and the site treats it as over the moment the time passes); the 3rd within 30 days bans instead (§10).
- **Admin pages** share a left sidebar (desktop-first, a menu on phones). Every money, settings, strike, ban, cancel, extend and force-award action asks for a short reason and is written to `audit_logs`.
- **Contest page in the admin (owner, 2026-10-14):** a **Client details** panel under Designs and Payments: name, username, status, last seen, business, mobile and email (with Call, WhatsApp, Message and Support chat), the bKash numbers they paid from, joined date, the country of their last visit, suspensions, totals (contests, spent, winners picked) and every contest they started. Mobile, email and bKash numbers only for **Users · manage**, as in the Users list. **Client's view** opens the client's contest page **read-only** for staff with Contests · view ("Admin view" note; no rating, shortlisting, picking, voting, commenting, add-ons or file actions). Unpaid contests (draft, awaiting payment) have no client page yet, so the link reads **Unpaid contests** instead.

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
4b. **Home hero slides** (`/admin/hero`, owner 2026-10-11; migration 0034, table `home_hero_slides`): the showcase slides at the top of the home page (UI-JOURNEY P-01). An admin adds a slide by uploading a **person photo** (JPG/PNG/WebP, at least 400×400) and a **colour logo** (PNG/WebP with a see-through background; the white logo is made from it automatically, or uploaded); the server re-saves both (photo as JPEG up to 1000 px without hidden data, logo as PNG up to 800 px with empty edges cut off) into the public `site` bucket under `hero-slides/`. Then: brand name, person's name, role (Designer / Client), the product drawn beside the photo (cup, ticket, bag, phone), four colours (suggested from the logo's main colour), which logo the round badge shows, the part of the photo to keep in view, and the two-line headline + one line of text in English and Bangla (Bangla falls back to English). A live preview uses the home page's own drawing. Slides can be reordered, switched on/off, edited and deleted; deleting removes their uploaded pictures. While no slide is switched on, the home page shows the four built-in sample slides, always with the "Sample artwork" pill; "Copy the 4 sample slides here" puts them in the list (switched off) to change one by one. Two settings on the same page: seconds per slide (1–10, default 2) and the "Sample artwork" pill (on by default; turn off once every slide is a real winner who agreed to be shown). Needs `content.manage` to change, `content.view` to look.
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
   - **Services** (owner, 2026-10-13; migration 0045): the kinds of contest clients can start. Logo is built in; other services (YouTube thumbnail, social post, Facebook cover, YouTube banner, X header, business card, flyer, T-shirt, and any the admin adds) each set their texts, size, uploads, final files, brief questions and default prize / days, and are switched on or off here (owner, 2026-10-13: an off service shows as Coming soon on the home page and `/start`, `/start/<key>` shows a Coming soon page, and the server refuses its drafts and payments; contests already running are never touched; every switch is in the Audit log, old → new). A contest keeps its service, answers and final-file list (`contests.service`, `service_brief`, `final_types`). See UI-JOURNEY "Contest services".
   - **Analytics:** visitors and page views today / 7 / 30 days with a daily chart, top pages, where visitors come from, devices, new sign-ups, and the wizard drop-off. Owner, 2026-10-13: plus a **Visitor pop-up** card (7 / 30 / 90 days: shown, clicks per button, closes, sign-ups from the pop-up and conversion), from anonymous `popup_events` and `profiles.signup_source` (migration 0044). The welcome pop-up itself (new visitors only, after 20 active seconds and a scroll, hidden 7 days after a close; both numbers and an on/off switch in Settings) is described in UI-JOURNEY.
   - **Activity feed:** the latest things people did: sign-ups, contests created and paid, designs sent, comments, winners picked, withdrawals asked.
4. **Unpaid contests:** clients who started a contest but did not pay (draft or waiting for payment): name, mobile, brand, how far they got, amount, last activity, with **Call** and **Send message**. Anonymous wizard drop-off stays on the dashboard.
5. **Support chat** (owner's choice: chat button on every page): signed-in clients and designers get a chat button in the corner of every page and a **Support** page; each user has one conversation with the support team. The admin **Support inbox** lists conversations (open / closed, newest first, unread counts), shows the user's details next to the chat, and staff can reply, close and reopen. New messages update every few seconds and send a bell and push notification to the other side. The no-contact filter does not apply to support chat.
   - **AI assistant (owner, 2026-10-15; migration `0058_support_ai`):** the assistant answers each chat first, at once, from what the site says about itself (the Q&A in Admin › Lists, How it works, the logo checker Q&A, the Pro plan, the policies' summaries, contact details, with numbers from Settings) and the person's own basics (role, Pro or Basic, confirmed email, their latest contests and their status). It never sees money they paid or are owed. It answers in the person's language (Bangla, English or Banglish), short and in plain text, links to site pages, and never asks for passwords or codes. It hands the chat to the team when the person asks for a person (also the **Talk to a person** button), for money paid or owed, bans, suspensions, copy claims, reports, disputes, site problems, anything it isn't sure of, after its daily limit (Settings › Support chat, 40 answers a day), or when the AI can't answer. Then the chat shows **Needs a person** in Admin › Support and every support staff member gets a bell and push.
   - **Who has the chat:** `support_threads.mode` is `ai`, `waiting` (handed over, nobody yet) or `human` (`assigned_to`). In the inbox (lists: Open, Needs a person, Mine, Closed) staff press **Assign to me** or **Assign to…** a colleague with Support · manage (they get a bell and push); replying also takes the chat. New messages then notify only the assigned person. **Give back to AI** and **Close** return the chat to the assistant. The assistant's messages are marked "AI assistant" (`support_messages.is_ai`). The AI runs on the logo checker's key (Gemini, else Claude). Settings › Support chat turns the assistant off (every chat then goes to the team). The Help page's **Live chat** opens this chat (Tawk.to only if chosen in Settings).
6. **Messages to users** (owner's choice: notification + inbox): an admin can message **all designers**, **all clients**, **everyone**, or **one person** (from their profile or by mobile / username). Each message arrives as a bell + push notification and also appears in the user's support chat, so they can reply. Every message is logged in the audit log.

### 13.3 Pricing & fees (owner, 2026-10-22; A-28, `/admin/pricing`)

One page for every price and fee clients and designers pay, with its own staff tick box "Pricing & fees" (Manager: view only): the client service fee (normal rate, big-prize rate and its threshold), package prizes and the custom prize rules, add-on prices and the free-from prize, extra days, the designer fee rows by counted wins (an editor that refuses rows that don't start at 0 or don't go up) and the counted-win rules, and dollar prices. Each save needs a reason and is written to the audit log. Every page reads the numbers on its next load (wizard, price pages, Q&A, legal pages, checkout, llms.txt within 10 minutes); contests already paid keep what they paid. The Pro plan price stays on Admin › Pro plan and promo codes on Payments › Promo codes (both linked). These settings are no longer shown on Admin › Settings.

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
- **`/sitemap.xml`:** home, Browse, Design Studio, How It Works (both tabs), Help, designer sign-up, the four legal pages, the guides (§15.2), every public live or finished contest and every active designer profile with at least one public design. **`/robots.txt`** points to it and blocks the private areas.
- **Canonical links** on contest pages (without `?tab=` / `?entry=`), designer profiles, Browse and the legal pages, so one address is indexed per page.
- **Share previews (Open Graph):** a site card for every page, and a contest card (brand name, prize in BDT, status) so links shared on Facebook and WhatsApp look right. Contests hidden from search get the site card only.
- **Structured data:** Organization and WebSite on the home page.
- **One address for both languages:** English and Bangla share each URL (the language is a cookie), so search engines index the English version; there are no separate language URLs for now.
- **Performance:** Bangla fonts load only the Bengali characters, and the Bangla display font loads only when used; images are lazy-loaded; a production build is checked for oversized pages.
- **Backups:** see §18.4.

### 15.2 Guides (owner, 2026-10-15)

- **What:** articles for clients and designers, written by the owner's team in **Admin › Guides** (`content.view` to read, `content.manage` to change). Table `guides` (migration 0060), read by the server only.
- **Pages:** `/guides` (all, with For clients / For designers; "For everyone" guides show in both) and `/guides/<address>`: title, summary, date, reading time, cover, the text, a next step (Start a contest / Browse or Join / Logo checker) and three more guides. Article and breadcrumb structured data, a canonical link and a share preview with the cover.
- **Writing:** English is needed to publish (a title, a summary of at least 50 characters, at least 150 words); Bangla is optional and Bangla readers see English where it is empty. The text uses a few simple marks (headings, bold, lists, links, pictures), never HTML. Links go to this site's pages or `https` addresses (outside links get `nofollow`); pictures must be uploaded in the editor (site bucket, `guides/`).
- **Search:** published guides are in the sitemap; `/guides` joins it once one guide is published (until then it is `noindex`). Up to five guides marked "Show in the footer" appear in a Guides column with "All guides".
- **Google's rules:** no hidden pages or hidden text, no near-copies made for keywords, own words and own pictures only. Admin › Guides shows these rules next to the list.

### 15.4 Usernames and names (owner, 2026-10-15/16; migration `0063_usernames`)

- Every client and designer has one username, and can log in with it, their email or their mobile number.
- Clients get theirs from their name when the account is made (`anika_jaman`, `anika_jaman2` when taken; `client_1234` for a name without Latin letters). Designers pick theirs at sign-up. **Anyone can change it once every 60 days** (owner, 2026-10-16; Profile settings, `profiles.username_changed_at`).
- **Names can't be changed** by their owner (owner, 2026-10-16): they are checked against payments and payouts, so sign-up asks people to check them. The team corrects a mistake in Admin › Users › Correct name (reason, audit log `correct_name`).
- Old usernames are kept in `username_history`: `/d/old`, `/designer/old` and `/c/old` forward to the new name, an old Designer ID still finds the designer, and nobody else can take an old name.
- Clients have no business name on their profile: each contest has its own brand name; Pro chat shows the contest's brand.

### 15.3 Profile settings (owner, 2026-10-15)

- **Order:** photo, name and bio; payout method (designers); mobile; email (with the code box while it isn't confirmed); password; then the portfolio (designers). No email settings: see §12 "Email settings".
- **Save buttons:** in the brand colour while nothing has changed, green as soon as something is changed, back to the brand colour once the save worked (a failed save stays green).
- **Fields keep what was typed:** every field is controlled, so a save that is refused (or the form resetting after a save) never blanks a field that the next save would then wipe.
- **Profile photo:** a real photo of the person; avatars, cartoons, logos and other pictures are not allowed.

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
10. **Profiles and gamification:** public designer profile (no money since 2026-10-12), public client profile with total spent, badges, leaderboard, monthly winner
11. **Launch polish:** Bangla translations, SEO basics (titles, sitemap, `noindex` for private contests), legal pages, performance pass, backups
12. **Site content (owner, 2026-10-09):** texts, lists, legal pages, pictures, contact details and a notice bar, all editable in the admin panel (section 13.1)
13. **Admin panel 2.0 (owner, 2026-10-09):** own admin layout, Super admin and staff permissions, live visitors and analytics, unpaid contests, support chat and messages to users (section 13.2)

## 17. Out of scope for now

Direct messaging, refunds, NID verification, design categories other than logos, hiring a designer one-to-one, mobile apps, featured/highlighted upgrades, second and third prizes.

## 18. Things the owner still needs to settle

1. All **[CONFIRM]** items are settled (owner, 2026-10-07): counted wins (prize ≥ 3,000, at least 3 designers, at most 2 wins per client); upgrades ৳1,000 each; Monthly Champion ৳5,000; payment gateway SSLCommerz. (Also settled: no free or automatic extension; extension price ৳500 per day, 3/5/7 days, prompt under 5 entries; the normal designer fee applies to no-result shares; entries per designer unlimited; fee rate locked at winner pick; no-result rule; 3-day re-pick after a missed deadline.)
2. SSLCommerz merchant account and its documents (needed for milestone 9)
3. Legal check with a CA/lawyer: holding client funds, tax on designer payouts, VAT on the service fee, and the wording of the no-refund policy. Owner, 2026-10-09: the lawyer also checks the four legal pages and the designer originality agreement (especially the legal-action clause and storing ID numbers) before launch
4. **Backups (2026-10-09):** the Supabase Free plan keeps no downloadable daily backups. Before launch, move the project to **Supabase Pro** (daily backups kept 7 days; point-in-time recovery is an extra). Until then, and as a second copy afterwards, `npm run backup:db` (a `pg_dump` of the database, needs `SUPABASE_DB_URL` in `.env.local`) and `npm run backup:files` (downloads the storage buckets) save to `backups/`, which is never committed. Keep a copy off this computer.

# logocontest.bd — Build Blueprint

This file is the single source of truth for building logocontest.bd. Read it fully before writing code. Build one milestone at a time (section 16) and do not add features that are not listed here.

Items marked **[CONFIRM]** are proposed defaults the owner has not confirmed yet. Build them as admin-configurable settings so they can change without code edits.

---

## 1. Product summary

logocontest.bd is a Bangladesh-only, logo-only design contest platform. All money is in BDT (whole taka, stored as integers).

- A **client** fills in a brief, pays up front, and the contest goes live.
- **Designers** submit logo entries (5 to 10 images each). A designer may submit as many entries to a contest as they like.
- The client rates, comments, rejects, and finally picks one winner.
- The winner delivers source files within 3 days, or the win is cancelled and the client picks another entry. After the client approves the files (with a star rating and short feedback), the prize (minus the designer fee) lands in the designer's wallet and can be withdrawn.
- Clients and designers can never contact each other directly.

Marketing targets clients. Designers are expected to arrive on their own.

## 2. Locked business rules

| Rule | Value |
|---|---|
| Client service fee | 20% of prize, added on top (prize 5,000 → client pays 6,000) |
| Designer fee | 7% (0–4 wins), 5% (5–9 wins), 2% (10+ wins) |
| Refunds | None. All payments are non-refundable |
| Entry visibility | Client chooses. Open is the default and free. Blind is a paid upgrade (only the client ever sees the entries, see §7.4) |
| Entries per designer | Unlimited. To answer client feedback, a designer submits a new entry |
| Late delivery | If the winner does not upload the final files within 3 days, the win is cancelled and the client picks another entry |
| Copy flags | Any designer can flag an entry as copied, with a reason, a similar-logo image and links. Admin upholds or dismisses |
| NID verification | Not used |
| Funds | Platform holds the client's payment until handover is approved |
| Payout | Win → deliver files → client approves with a 1–5 star rating and feedback (max 120 words) → wallet credit → designer withdraws |
| AI | AI-generated logos are banned. AI-generated mockups/backgrounds are allowed |
| Reject | Client can reject any entry to keep the contest clean |
| Messaging | No direct messaging. Only a comment + reply thread on each entry |
| Copied logo | Permanent ban |
| Packages | Economy 3,000 / Standard 5,000 / Premium 10,000 / Custom (min 3,000, step 500) |

Fee tier timing: the rate is decided by the designer's count of completed wins at the moment the winner is selected, and stored on the handover so it cannot change later. So the 5th win is still charged 7%, and the 6th is charged 5%. (The client's price is fixed when they pay; the contest goes live only after payment.)

Low-entry rule **[CONFIRM]**: because there are no refunds, if a contest ends with fewer than 5 active (not rejected) entries it is extended free by 5 days, once.

No-pick rule: if the client does not pick a winner within 5 days of the contest ending, the highest-rated entry wins automatically (admin decides when there are no ratings).

Silent client rule **[CONFIRM]** (owner, 2026-10-07): "If the client does nothing, everyone who entered gets paid; designers with better ratings get more, the others get less." Open points before milestone 6: which silence triggers it (no winner picked, or no response to delivered files, or both); how shares are weighted, and what unrated entries get when the client gave no ratings; whether shares are per designer or per entry; the designer fee on each share; and who delivers files and transfers copyright. Until settled, the no-pick rule above applies.

## 3. Roles

| Role | Can do |
|---|---|
| Guest | Browse contests, winners, designer profiles, start the wizard |
| Client | Create and pay for contests, rate, comment, reject, shortlist, pick winner, approve handover |
| Designer | Submit entries, reply to comments, deliver files, withdraw wallet balance |
| Admin | Everything in section 13 |

One account has one role. One mobile number can hold one account.

## 4. Tech stack

- **App:** Next.js (App Router, TypeScript), server actions for every mutation
- **Database and auth:** Supabase (Postgres + Auth). Row-level security on every table as a second line of defence
- **Frontend:** React + Tailwind CSS, mobile-first (design for 360px width first)
- **Background jobs:** a scheduled job every 15 minutes (chosen in milestone 6)
- **Storage:** Supabase Storage (S3-compatible). Originals in a private bucket, watermarked previews in a public one
- **Images:** server-side resize + watermark (library chosen in milestone 4)
- **Auth:** mobile number + password, mobile verified by SMS OTP
- **Payments:** behind a `PaymentGateway` interface with a `FakeGateway` for local/dev. Real driver (aamarPay or SSLCommerz, covering bKash and cards) is added in milestone 9
- **SMS:** behind an `SmsSender` interface with a log driver for dev
- **Languages:** English default with a Bangla toggle. Use the en/bn message files from day one; never hard-code user-facing strings

## 5. Data model

All tables have `id`, `created_at`, `updated_at`. Money columns are unsigned integers in taka.

**users**: role (client/designer/admin), name, username (designers, unique), mobile (unique), mobile_verified_at, email (nullable), password, avatar_path, bio (designers, max 300), business_name (clients), status (active/suspended/banned), strikes (int), flag_warnings (int, false flags; 3 = ban), wins_count (int, all completed wins, shown on the profile), counted_wins_count (int, wins that count toward fee tiers and the leaderboard, §7.2), locale (en/bn, for SMS and notifications). In Supabase, `auth.users` holds the password and `public.profiles` holds the rest

**designer_payout_methods**: user_id, type (bkash/bank), bkash_number, bank_name, branch, account_name, account_number, routing_number, is_default

**contests**: client_id, slug, status, brand_name, logo_text, slogan, business_type, business_description, website_url, styles (json), style_sliders (json), colors (json, up to 5 hex), let_designers_choose_colors (bool), used_on (json), likes_text, dislikes_text, package (economy/standard/premium/custom), prize_amount, service_fee_amount, upgrades_amount, total_amount, duration_days, is_blind, is_private, is_promoted, winner_is_public (bool, blind contests only, set by the client after completion), starts_at, ends_at, judging_ends_at, extended_once (bool), winner_entry_id, completed_at

**contest_files**: contest_id, type (example/current_logo), path, original_name

**entries**: contest_id, designer_id, number (per-contest sequence), status (active/rejected/withdrawn/removed/winner/forfeited; forfeited = won but files not delivered in time), logo_story (50–600 chars), rating (1–5, nullable), is_shortlisted, reject_reason, reject_note, rejected_at, declarations (json), declared_ip, declared_at

**entry_images**: entry_id, slot (icon/full_logo/logo_story/facebook_cover/other/extra), position, original_path, preview_path, phash

**entry_comments**: entry_id, user_id, body, parent_id (nullable), is_blocked (bool)

**handovers**: contest_id, entry_id, status (awaiting_files/submitted/revision_requested/approved/auto_approved/cancelled), fee_rate (locked when the winner is picked), revision_count, fonts_note, agreement_accepted_at, due_at, approved_at, client_rating (1–5), client_feedback (max 120 words)

**handover_files**: handover_id, file_type (ai/eps/svg/pdf/png/jpg), path

**payments**: contest_id, client_id, gateway, gateway_txn_id, amount, status (initiated/paid/failed), paid_at, raw_response (json)

**wallet_transactions**: designer_id, type (prize_credit/withdrawal/adjustment/bonus), amount (signed), contest_id (nullable), fee_rate, fee_amount, balance_after, note

**withdrawals**: designer_id, payout_method_id, amount, status (requested/paid/rejected), paid_txn_id, processed_by, processed_at

**reports**: reporter_id (client or designer), entry_id, reason (ai/copied/contact_info/other), evidence_image_path (similar logo, optional), evidence_urls (json, optional), note, status (open/upheld/dismissed), resolved_by

**strikes**: user_id, reason, entry_id (nullable), contest_id (nullable), issued_by, issuer_role (client/admin), created_at

**notifications**: user_id, type, data (json), read_at

**monthly_winners**: designer_id, month (YYYY-MM), wins, prize_amount

**settings**: key, value (json) — every number in this document that an admin might change

**blocked_terms**: term, language, type (phone/email/social/link/custom)

**audit_logs**: admin_id, action, subject_type, subject_id, changes (json)

## 6. Contest lifecycle

```
draft → pending_payment → open → judging → winner_selected → handover → completed
                                    ↘ extended (back to open, once)
handover → judging (winner missed the 3-day file deadline; win cancelled)
any state → cancelled (admin only)
```

| Status | Meaning | Leaves when |
|---|---|---|
| draft | Wizard not finished or not paid | Client reaches payment |
| pending_payment | Checkout started | Gateway confirms payment |
| open | Live, accepting entries | `ends_at` passes |
| judging | No new entries; client decides | Winner picked, or 5 days pass (then the highest-rated entry wins) |
| winner_selected | Winner chosen | Handover record created (immediate) |
| handover | Designer uploads files, client reviews | Client approves (rating + feedback), or 5 days after files are submitted **[CONFIRM]**, see the silent client rule in §2, or the designer misses the upload deadline (→ judging) |
| completed | Wallet credited | — |

Timers (all in settings): duration 5/7/10 days (default 7); judging window 5 days; after a missed file deadline the client gets 3 days to pick again; designer must upload files within 3 days; client auto-approves after 5 days (the 5 days restart each time files are re-submitted); max 2 revision requests.

Missed file deadline: the winning entry becomes `forfeited`, the handover `cancelled`, and the contest returns to `judging` for 3 days. The client picks another entry (the forfeited one cannot be picked again). If they do not, the highest-rated remaining entry wins (admin decides when there are no ratings). The designer gets no automatic strike; the client may give one (§10).

A scheduled command runs every 15 minutes to move contests between states and send reminders.

## 7. Money

### 7.1 Client charge

```
service_fee = round(prize * 0.20)
total       = prize + service_fee + upgrades_total
```

| Package | Prize | Fee | Total (no upgrades) |
|---|---|---|---|
| Economy | 3,000 | 600 | 3,600 |
| Standard | 5,000 | 1,000 | 6,000 |
| Premium | 10,000 | 2,000 | 12,000 |

Always show the client the full breakdown before payment.

### 7.2 Designer payout

```
rate   = 0.07 if wins_count < 5; 0.05 if wins_count < 10; else 0.02
fee    = round(prize * rate)
credit = prize - fee
```

`counted_wins_count` is read when the winner is picked, and the resulting rate is stored on the handover. Increment `wins_count` (and `counted_wins_count`, if the win counts) only when the contest reaches `completed`.

A win only counts toward the tier and the leaderboard **[CONFIRM]** when prize ≥ 3,000 and the contest had entries from at least 3 different designers. At most 2 wins from the same client count.

### 7.3 Wallet

- The wallet is a ledger. Never store a balance without a matching `wallet_transactions` row.
- Credit happens once, inside a database transaction, when the handover becomes approved or auto-approved.
- Withdrawal: minimum 500; the request deducts the balance immediately; admin pays out manually by bKash or bank and records the transaction ID. A rejected withdrawal returns the amount.

### 7.4 Upgrades (prices in settings)

| Upgrade | Effect | Price [CONFIRM] |
|---|---|---|
| Blind | Only the client sees the entries; each designer sees only their own. Nobody else ever sees them, even after completion, except that after completion the client may choose to make the winning logo public, shown with the designer's name | 500 |
| Private | Login required to view the brief, `noindex`, hidden from winners gallery and designer portfolios | 500 |
| Promoted | Flag for admin to post it on the Facebook page/group; shown first in lists | 500 |

## 8. Client flow

### 8.1 Wizard (`/start`)

One question per screen, progress bar, Back/Next, autosave to the browser. Once the account exists (after step 10) the contest is saved on the server as a `draft`, so an unpaid contest can be finished later. No login is needed for steps 1–8.

1. Business or brand name (required, 2–60 chars); optional logo text and slogan
2. Business type (dropdown) + short description (20–300 chars)
3. Website or Facebook page link (optional, "I don't have one" checkbox)
4. Logo styles, multi-select with example images: Wordmark, Lettermark, Pictorial, Abstract, Emblem, Mascot, Bangla/Arabic calligraphy
5. Up to 5 colors with hex codes, or "Let designers choose"; and "Logo will be used on": Facebook/Instagram, Website, Signboard, Packaging, Print, Merchandise, TV/Video
6. What you like / what you don't like (two text areas; "like" min 30 chars)
7. Upload examples or current logo (optional, max 5 files, JPG/PNG/PDF, 5 MB each)
8. Package (Economy / Standard / Premium / Custom), duration, upgrades, live order summary
9. Mobile number (OTP) and email (optional)
10. Password
11. Your name, then payment (bKash / card), with a checkbox accepting Terms and the no-refund policy

Success screen: "Congratulations, your logo contest is live", contest link, share button, button to dashboard.

A logged-in client uses **Create Contest** from the dashboard: steps 1–8, then 11. A contest is never published without a successful payment.

### 8.2 Client dashboard

- My contests with status, days left, entry count
- Contest view: entries grid; on each entry: 1–5 stars, comment, shortlist, **Reject**, **Pick winner**
- Rejected tab
- Handover view: download files, Request revision (max 2), or Approve. Approving requires a 1–5 star rating and feedback (max 120 words); only then is the designer paid
- Blind contests, after completion: a switch to make the winning logo public
- Payments list and total spent
- Profile: name, business name, photo, mobile, email, password, and **Total spent** (sum of paid payments). Clients have no public profile, so only the client and admins see it

### 8.3 Reject

Reasons: Looks AI-generated / Looks copied / Doesn't match the brief / Low quality / Other (short note).

On reject: the entry disappears from the contest for everyone except the client's Rejected tab and the designer's own list; the designer is notified with the reason. Reasons "AI" and "copied" also create a report for admin. Strikes are never automatic; see §10 for who can give one. Only an admin can ban.

## 9. Designer flow

### 9.1 Signup

Full name, mobile (OTP), email, password, bio, payout method (bKash number or bank details), username, acceptance of Designer Rules.

### 9.2 Submitting an entry

- 5 required image slots: Icon, Full logo, Logo story, Facebook cover mockup, Other mockup. Up to 5 extra. Minimum 5, maximum 10 images.
- JPG/PNG/WebP, max 5 MB each, minimum 1000 px on the short side
- Logo story text, 50–600 characters
- No limit on entries per designer per contest. When the client asks for changes in a comment, the designer answers by submitting a new entry
- On upload: store the original privately, generate a preview (max 1200 px) with a tiled "logocontest.bd #entry" watermark, compute a perceptual hash and flag near-duplicates of existing entries for admin

Required checkboxes (store with timestamp and IP):

1. I made this logo myself for this contest. It is not copied or traced from any other logo, template, or stock artwork.
2. This is a custom design for this brief, not a pre-made or resold logo.
3. It does not use any trademarked or famous-brand element.
4. No part of the logo was generated by AI. (AI is allowed only for mockup backgrounds.)
5. If I win, I will deliver AI, EPS, SVG, PDF, PNG and JPG files within 3 days.
6. I will not share or ask for any contact details.
7. I understand that a copied or AI-generated logo means removal and a permanent ban.

### 9.3 Handover

The winner uploads AI, EPS, SVG, PDF, transparent PNG and JPG files plus font names, and accepts a copyright transfer agreement, within 3 days. All six file types are required before submitting. If the deadline passes, the win is cancelled (§6). When the client requests a revision, the designer uploads revised files. An admin can inspect the vector source if the entry was reported as AI.

### 9.4 Public profile (`/d/{username}`)

Shows only: name, bio, photo, badges, win count, **total earned** (public: sum of `prize_credit` and `bonus` wallet transactions, after fees), winning logos, all submitted logos with their star ratings, a QR code and a copyable profile link. No contact details anywhere. Entries from private contests are never shown. Entries from blind contests are never shown, except the winning logo once the client has made it public. The win count shown is `wins_count` (all completed wins).

### 9.5 Wallet page

Available balance, pending (won but not yet approved), current fee rate with progress to the next tier, withdraw form, transaction history.

## 10. Comments and the no-contact filter

- Each entry has one thread visible only to that client, that designer, and admins.
- Turns alternate: the client comments, the designer may reply once, and so on.
- Run the filter on comments, bios, logo stories, brief text and file names. Block the submission and show: "Contact details are not allowed."

The filter must catch:

- Bangladeshi mobile numbers (`01[3-9]` + 8 digits, `+880`), including digits split by spaces, dots or dashes
- Bangla digits (০–৯): normalize to Latin digits first
- Numbers spelled out in English, Bangla or Banglish (six or more number words in a row)
- Emails, `@`, "gmail", "dot com"
- Links and platform names: http, www, .com, .bd, facebook, fb, m.me, whatsapp, wa.me, imo, telegram, instagram, behance
- Any term in `blocked_terms`

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

Monthly winner: ties are broken by total prize value, then by average rating of winning entries. The system proposes the winner on the 1st; an admin confirms; the prize is added to the wallet as a `bonus` transaction. Prize amount is a setting.

## 12. Notifications

Channels: in-app for everything, plus SMS and email where marked.

| Event | To | SMS/Email |
|---|---|---|
| Contest live / payment received | Client | Yes |
| New entry (batched every 3 hours) | Client | Email |
| Contest ends in 24 hours | Client and entered designers | Email |
| Pick-a-winner reminders (day 1, 3, 5) | Client | Yes |
| Strike received (with reason) | Designer | Yes |
| False-flag warning | Flagger | Yes |
| Rating given | Designer | No |
| New comment or reply | Other party | Email |
| Entry rejected (with reason) | Designer | No |
| You won | Designer | Yes |
| Files submitted / revision requested | Client / Designer | Yes |
| Wallet credited | Designer | Yes |
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

## 14. Public pages

**Header menu (exactly four items):** Browse Contests | How It Works | Call: 01712028511 | Log In

**Home page sections, in this order:**

1. Hero. Headline: "Many designers. Many ideas. One perfect logo." Sub-line: "Get your logo from Bangladesh's best designers." Button: **Get Started** → `/start`
2. Recent winning logos, three rows, then **Browse more** → `/contests`. Until real winners exist, show live contests instead. Never show invented numbers or fake winners.
3. How it works: (1) Tell us about your brand (2) Get designs and give feedback (3) Pick your winner and get your files
4. Why Logo Contest: many ideas for one price; pay in taka with bKash; original, human-made logos only; full ownership of the winning logo; your payment is held safely until you approve the files
5. For designers: "Win more, pay less: 7% → 5% → 2%", Monthly Champion prize, portfolio link with QR code
6. Q&A
7. Footer: Terms, Privacy, Payment & No-Refund Policy, Designer Rules, Contact

Other pages: `/contests` (filters: open, judging, completed), `/contest/{slug}`, `/winners`, `/d/{username}`, `/how-it-works`, `/designers` (designer landing + signup), `/faq`, legal pages.

## 15. Non-functional requirements

- Mobile-first; pages must work well on a slow 4G phone (compress images, lazy-load grids)
- All state changes and money movements go through service classes with tests, never directly from controllers
- Authorization via policy functions; a designer must never reach another designer's originals, and never see other entries in a blind contest
- Original files are served only through signed, expiring URLs
- Rate-limit OTP, login, comments and uploads
- Verify payment gateway callbacks server-side before marking anything paid
- Feature tests are required for: fee calculation, tier changes at 5 and 10 wins, contest state transitions (including the missed file deadline), wallet credit happening exactly once, the contact filter, blind-contest visibility

## 16. Build milestones

Finish, test and commit each milestone before starting the next.

1. **Foundation:** Next.js + Supabase project, Tailwind layout, localization setup, settings table with seeded defaults, roles, mobile + OTP auth (log driver), basic admin login
2. **Contest wizard:** all 11 steps with autosave and drafts, `FakeGateway` payment, contest goes `open`, success screen
3. **Browse and contest pages:** `/contests`, contest detail, home page with live data
4. **Designer side:** signup, payout method, entry upload with slots, watermarking, declarations, blind/open visibility rules
5. **Client review:** ratings, shortlist, reject with reasons, comment threads, contact filter, report button, designer copy flags with evidence
6. **Lifecycle engine:** scheduler, judging, low-entry extension, pick winner, auto-award
7. **Handover and wallet:** file delivery, missed-deadline cancellation, approval with rating and feedback, auto-approval, fee tiers, wallet ledger, withdrawals
8. **Admin panel:** everything in section 13
9. **Real integrations:** payment gateway driver, SMS provider, email, S3 storage
10. **Profiles and gamification:** public designer profile with QR, badges, leaderboard, monthly winner
11. **Launch polish:** Bangla translations, SEO basics (titles, sitemap, `noindex` for private contests), legal pages, performance pass, backups

## 17. Out of scope for now

Direct messaging, refunds, NID verification, international payments, design categories other than logos, hiring a designer one-to-one, mobile apps, featured/highlighted upgrades, second and third prizes.

## 18. Things the owner still needs to settle

1. The **[CONFIRM]** items: low-entry extension, the silent client rule (§2) and how it relates to auto-approval after 5 days. (Settled: entries per designer unlimited; fee rate locked at winner pick; no-pick auto-award after 5 days; 3-day re-pick after a missed deadline.)
2. Upgrade prices (Blind, Private, Promoted)
3. Monthly Champion prize amount
4. Which payment gateway to apply to, and its merchant documents
5. Legal check with a CA/lawyer: holding client funds, tax on designer payouts, VAT on the service fee, and the wording of the no-refund policy

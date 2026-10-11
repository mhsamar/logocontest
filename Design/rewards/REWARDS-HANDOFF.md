# logocontest.bd: monthly rewards, win cards and leaderboard — design handoff

Put this whole folder in the repo at `design/rewards/`. The `.html` files are static design references. They are not code to paste in.

## Rules for every step

1. Open the matching `.html` file and copy its layout, spacing, colours and wording.
2. Never copy numbers, names, photos or rows from the design files. Everything marked "Sample data", "Sample numbers" or written in `[square brackets]` is a placeholder. Show real data from the database, and a proper empty state when there is none.
3. The people photos and brand logos inside the design files are samples. Do not ship them. Use each user's real profile photo (or initials when there is none) and the real winning logo.
4. Every page must work at 390px wide with no sideways page scroll.
5. Reuse the existing site layout, admin layout and shared components. Keep existing data fetching, auth, permissions and routes.
6. All month maths uses the **Asia/Dhaka** time zone.
7. After each phase: run build and lint, open the page, and tell me what you changed and anything you could not match.

## File map

| Design file | Where it goes | Type |
|---|---|---|
| `home-hero-offer-slide.html` | Home hero, slide 5 | Update: two new buttons |
| `home-ai-checker-section.html` | Home page section | Already handed over; included for reference |
| `buyer-home-smartphone.html` | Client home (logged in), top panel | New panel |
| `designer-home-gift-box.html` | Designer home (logged in), top panel | New panel |
| `designer-win-card.html` | Shown to the designer after winning a contest | **New feature** |
| `client-smartphone-claim.html` | Client profile: monthly prize, 3 steps | **New feature** |
| `designer-gift-box-claim.html` | Designer profile: monthly prize, 3 steps | **New feature** |
| `leaderboard.html` | Public page `/leaderboard` | **New feature** |
| `admin-monthly-winner.html` | Admin → Monthly winner | **New feature** |

## A. The rules (decided by the owner)

- **Smartphone, for clients:** every month, the client who ran the most contests wins. If two are equal, the bigger total prize money wins.
- **Gift box, for designers:** every month, the designer who won the most contests gets it. **Tie rule is not decided: ask the owner before building.**
- A contest counts for a client only when it is paid and went live in that month. Cancelled or refunded contests do not count.
- A win counts for a designer in the month the winner was picked.
- Admin, staff and test accounts never appear in the race.
- Winners are fixed at the end of the last day of the month. Cards are sent automatically at that moment.
- Not decided yet, keep as Settings fields and show nothing while empty: which smartphone, what is in the gift box, the claim deadline.

## B. Data

- `monthly_rewards`: id (shown as `RW-0001`), month, kind (`smartphone` or `gift_box`), winner user id, a frozen copy of the winner's numbers (contests, prize money, spent / wins, earned), card image paths, status (`not_claimed`, `claimed`, `contacted`, `delivered`), claim full name, claim mobile, claim address, claimed/contacted/delivered timestamps, admin note. One row per month and kind (unique).
- `win_cards`: one per contest winner: contest, design, designer, square image path, story image path, public share slug.
- Settings: the four switches from the admin page, the prize texts, the claim deadline.
- Claim details are private. Row Level Security: only the winner can write their own claim, once; only admins with Monthly winner permission can read it. Never return claim details to any public page.

## C. Designer win card (`designer-win-card.html`)

- Created right after the client picks the winner. The designer gets an in-app notification and an email, and sees the card on the dashboard.
- Make the image on the server, in two sizes: 1080 × 1080 and 1080 × 1920. It has the site logo, the designer's profile photo, the winning logo, the name and the contest name.
- Buttons: Download image; Share on Facebook; Share on Instagram; copy link.
- Sharing: on phones use the Web Share API with the image file, so the user can pick Instagram or Facebook. Where that is not supported, download the image. For Facebook on desktop, share a public page for the win (`/wins/[slug]`) whose Open Graph image is the card. Websites cannot post directly to Instagram: do not promise that in the wording.
- Do not make a card when the contest is private or hidden.

## D. Monthly prize claim (both claim files)

- Step 1, on the profile and by email: congratulation with the photo card, "Claim my smartphone / gift box", plus download and share.
- Step 2, form: full name, mobile number (Bangladesh format, 11 digits starting with 01), full address, "These details are correct" checkbox. Validate on the server.
- Step 3: "Claim successful. Logo Contest BD will contact you soon." with the claim ID and the three progress steps.
- One claim per reward. After claiming, the form is read-only; changes go through support.
- When a claim arrives: notify the admins in-app and by email, and show it under "Call them" on the admin page.
- Send a reminder to winners who have not claimed (count shown in admin).

## E. Month close job

- Runs at 23:59 Asia/Dhaka on the last day of every month. Use whatever scheduled-job tool the project already uses; if none, propose one and wait.
- It picks both winners with the rules in A, creates the two `monthly_rewards` rows, makes the cards, and sends the notifications.
- It must be safe to run twice: never create two rewards for the same month and kind.
- "Ask me first" switch: when on, the job prepares everything but waits for the admin to approve before anything is sent.
- "Close the month and send now" in admin runs the same job by hand, with a confirm step. Write every run to the audit log.
- If nobody qualifies in a month, create nothing and show "No winner this month".

## F. Leaderboard (`leaderboard.html`, public)

- This month: counts at the top (contests posted, clients in the race, contests won, designers with a win), top clients by contests (prize money shown, because it breaks ties), top designers by wins.
- Month tabs and "Winners of past months" from `monthly_rewards`.
- Public page shows display name and profile photo only. Do **not** show designer earnings, client spending, phone numbers or addresses.
- Link it from the main menu and from the two new buttons on hero slide 5 ("See who is leading", "See the leaderboard").
- Cache it for a few minutes; it does not need to be real time.

## G. Admin → Monthly winner (`admin-monthly-winner.html`)

- The sidebar item already exists. Add a permission area "Monthly winner" (View / Manage).
- KPIs, the four switches, the two tables (designers: wins, contests joined, earned; clients: contests, prize money, spent), "Prizes and claims" with status filters, and the claim details panel with note, "Mark as contacted", "Mark as delivered", "Make a ticket".
- Money numbers come from the payments and payouts already in the database. Do not invent a new way to count them.

## H. Home panels

- `buyer-home-smartphone.html` and `designer-home-gift-box.html`: the right-hand panel shows the user's own number this month, the leader's number, days left and a link to the rules. Use real numbers.

## I. Before going live

1. Add a rules page for the monthly prizes and link it from "See the rules" and "Read the rules". The owner must approve the text.
2. Add a line to the terms: winners' names, photos and winning logos may be shown on the leaderboard and on shareable cards.
3. Fill the Settings fields: which smartphone, gift box contents, claim deadline, tie rule for designers.
4. Test on a preview deployment with test accounts: run the month close by hand, claim both prizes, check the admin page, check the cards and sharing on a real phone.
5. Only then deploy to production.

---

## Prompt for Claude Code (paste this as one message)

```
Read design/rewards/REWARDS-HANDOFF.md fully, then look at how the project is built today (routes, Supabase tables, RLS, notifications, emails, scheduled jobs, admin permissions).

Before writing code, give me:
1. A short plan in phases.
2. The database changes you will make.
3. A list of questions for anything the handoff marks as not decided (designer tie rule, which smartphone, gift box contents, claim deadline, scheduled-job tool).
Then wait for my answers.

Build in this order, one phase at a time. After each phase run build and lint, show me what changed, and wait for my OK:
Phase 1: database tables, RLS and Settings fields.
Phase 2: counting logic for the month (clients and designers) with tests, using Asia/Dhaka time.
Phase 3: public /leaderboard page, the menu link, and the two new buttons on hero slide 5.
Phase 4: designer win card: image in two sizes, dashboard view, download and share, public /wins/[slug] page.
Phase 5: month close job, the two monthly cards, notifications and emails.
Phase 6: claim flow for smartphone and gift box.
Phase 7: Admin → Monthly winner page with permission, statuses, notes and audit log.
Phase 8: buyer and designer home panels with real numbers.

Rules: follow the design files for layout and wording, never copy sample data, sample photos or sample logos, keep everything working at 390px wide, keep claim details private with RLS, and do not deploy to production. I will test on a preview first.
```

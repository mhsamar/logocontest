# logocontest.bd — Website + Admin, A to Z

A step-by-step guide to put the website online, connect your admin account to it, keep it running, and use the admin
panel every day. Follow the parts in order the first time. Later, Part E (the admin manual) is the one you'll use most.

> **Golden rule:** never paste passwords, keys or secrets into chat, email or WhatsApp. They go only into
> `.env.local` on your computer, or the hosting provider's "Environment Variables" page.

**Contents**

- Part A — How the pieces fit together
- Part B — Put the website online (one time)
- Part C — Connect your admin account
- Part D — Keep it running: the 15-minute job and backups
- Part E — Admin panel manual (every screen)
- Part F — Your routine: daily, weekly, monthly
- Part G — When something goes wrong

---

## Part A — How the pieces fit together

| Piece | What it is | Where it lives |
|---|---|---|
| **Code** | The website itself (Next.js) | GitHub: `github.com/mhsamar/logocontest` |
| **Hosting** | The computer that runs the website for visitors | Vercel (recommended) |
| **Database + files** | Accounts, contests, designs, payments, uploaded images | Supabase (project `logocontest-bd`) |
| **Domain** | `logocontest.bd` — the address people type | Your .bd domain registrar |
| **Admin panel** | Your control room at `logocontest.bd/admin` | Part of the same website |

The **website and the admin panel are the same app**. There is nothing separate to install: any account with the role
**admin** sees the admin panel after logging in. "Connecting" the admin means giving your account that role (Part C).

---

## Part B — Put the website online (one time)

### B1. Decide: same database or a fresh one?

Today the website on your computer uses the Supabase project marked **PRODUCTION**, and it holds test data
(Nodi Tea House, test designers, fake payments).

- **Recommended:** create a **new Supabase project** for the live site, so real users never see test data.
  Then run the migration files `supabase/migrations/0001…sql` to `0027…sql` **in order** in its SQL Editor
  (I can do this with you, one file at a time, like before).
- **Or** keep the current project and delete the test data before launch (ask me — I'll remove it safely).

Also move that live project to **Supabase Pro** before launch: the free plan keeps no backups you can download.

### B2. Supabase settings for the live site

In the Supabase project you'll use for the live site:

1. **Project Settings → API**: note the **Project URL**, the **anon public** key and the **service_role** key
   (keep service_role secret — it can read and change everything).
2. **Authentication → URL Configuration**:
   - **Site URL:** `https://logocontest.bd`
   - **Redirect URLs:** add `https://logocontest.bd/**` (so email confirmation and password-reset links work).
3. **Storage**: the buckets (`contest-files`, `entry-files`, `handover-files`, avatars) are created by the migrations. Nothing to click.

### B3. Create the hosting (Vercel)

1. Go to **vercel.com** and sign in with your GitHub account (`mhsamar`).
2. **Add New → Project → Import** the repository `logocontest`.
3. Framework: **Next.js** (detected automatically). Leave build settings as they are.
4. Plan: Vercel's free Hobby plan is for non-commercial use, so for a business choose **Pro** (check current price).
5. Before the first deploy, open **Environment Variables** and add everything in B4.
6. Click **Deploy**. You get a temporary address like `logocontest.vercel.app` — open it to check the site loads.
7. **Region:** the repo's `vercel.json` runs the site in Vercel's **Mumbai** region (`bom1`), next to the Supabase database (also Mumbai). Without it every page would cross the world several times and feel slow. If you ever move the database, change the region to match.

### B4. Environment variables (copy names exactly)

Add these in **Vercel → Project → Settings → Environment Variables** (environment: Production).

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | from B2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | from B2 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | secret |
| `OTP_SECRET` | a long random string | make one with `openssl rand -hex 32` |
| `APP_SECRET` | another long random string | different from the one above |
| `CRON_SECRET` | another long random string | used in Part D |
| `SITE_URL` | `https://logocontest.bd` | links, sitemap, share cards |
| `PAYMENT_DRIVER` | leave unset until SSLCommerz is connected (M9); the live site never runs the test checkout, so checkout is closed until then | see M9-SETUP.md |
| `PAYOUT_DRIVER` | `manual` | withdrawals go to Admin → Withdrawals until bKash payouts are connected |
| `EMAIL_DRIVER` | `log` until an email provider is connected | M9 |
| `SMS_DRIVER` | `log` until an SMS gateway is connected | M9 |
| `PUSH_DRIVER` | `log` (or `webpush` + the 3 VAPID values) | M9 |
| `MODERATION_DRIVER`, `LOGO_SCAN_DRIVER` | `log` (or `google` + `GOOGLE_VISION_API_KEY`) | M9 |

After changing any variable, **redeploy** (Vercel → Deployments → ⋯ → Redeploy) so the site picks it up.

> Real client payments need SSLCommerz (milestone 9). Until then the live site can be opened for designers, browsing
> and testing, but clients can't pay. See `M9-SETUP.md`.

### B5. Connect the domain `logocontest.bd`

1. Vercel → Project → **Settings → Domains** → add `logocontest.bd` and `www.logocontest.bd`.
2. Vercel shows the DNS records to create (an **A** record for `logocontest.bd` and a **CNAME** for `www`).
   Use exactly the values Vercel shows.
3. At your .bd registrar's DNS panel, create those records. (If the registrar's DNS panel is hard to use, you can move
   DNS to Cloudflare and add the same records there.)
4. Wait for the green tick in Vercel (minutes to a few hours). HTTPS is set up automatically.
5. Open `https://logocontest.bd` — the home page should load.

### B6. Quick check after going live

- [ ] Home, Browse contests, Winners, Leaderboard, Help and the legal pages open.
- [ ] `https://logocontest.bd/robots.txt` and `/sitemap.xml` open.
- [ ] Sign up as a test designer, confirm the email code (once email is connected), log in, log out.
- [ ] Log in as admin (Part C) and open the admin panel.

---

## Part C — Connect your admin account

You need **one account with the role admin**. Two ways:

### Option 1 — The seed script (creates the admin for you)

On your computer, in the project folder:

1. Put these in `.env.local` (pointing at the live Supabase project):
   - `ADMIN_PHONE` — your mobile, e.g. `017XXXXXXXX`
   - `ADMIN_EMAIL` — your email
   - `ADMIN_PASSWORD` — a strong password (12+ characters, not used anywhere else)
   - `ADMIN_NAME` — e.g. `Mehedi`
2. Run:
   ```bash
   npm run seed
   ```
3. It prints `✓ admin: … (created)`. It also fills in the default settings, and never overwrites settings you changed.

### Option 2 — Make an existing account admin

If you already signed up on the live site with your own account:

1. Supabase → **SQL Editor** → run (put your email in):
   ```sql
   update public.profiles set role = 'admin', status = 'active'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
2. Log out and log in again.

### Logging in

1. Go to `https://logocontest.bd/login`.
2. Enter your **mobile number or email** and password.
3. Admins land on **`/admin`** automatically. You can also open it any time from the avatar menu.

**Keep admin safe:** give the admin role only to people you fully trust; each person gets their own account (the audit
log shows who did what); never share one password.

---

## Part D — Keep it running

### D1. The 15-minute job (required)

The site has an automatic job at `/api/cron/lifecycle`. **It must run every 15 minutes**, or contests never end on their
own. It: ends contests and starts judging · sends "ends soon", 12h/6h and pick-a-winner reminders · announces new
contests to all designers · cancels wins when files are late · ends silent contests with "no result" and shares the
prize · releases held prizes after the claim period · lifts suspensions · proposes the Monthly Winner.

**Easiest: schedule it inside Supabase.** In the live project's SQL Editor, run once (replace `YOUR_CRON_SECRET` with
the same value as the `CRON_SECRET` variable in Vercel):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'logocontest-lifecycle',
  '*/15 * * * *',
  $$ select net.http_get(
       url := 'https://logocontest.bd/api/cron/lifecycle',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
     ); $$
);
```

Check it works: Supabase → **Integrations → Cron** (or run `select * from cron.job_run_details order by start_time desc limit 5;`).
To stop it: `select cron.unschedule('logocontest-lifecycle');`

### D2. Backups

- **Supabase Pro:** daily backups are kept for 7 days (Database → Backups).
- **Your own copy (recommended weekly):** on your computer
  ```bash
  npm run backup:db
  ```
  ```bash
  npm run backup:files
  ```
  They save into the `backups/` folder (never uploaded to GitHub). `backup:db` needs `SUPABASE_DB_URL` in `.env.local`
  and `pg_dump` installed. Copy the folder to an external drive or private cloud storage.

### D3. Updating the website later

When new code is pushed to GitHub `main`, Vercel builds and publishes it automatically (2–3 minutes). If a change
needs a new migration file, it must be run in Supabase **before** or right after the deploy — I'll always tell you.

---

## Part E — Admin panel manual

Open **`logocontest.bd/admin`**. The left menu (top menu on phones) has these screens. Red numbers next to
**Reports**, **Copy claims** and **Withdrawals** mean something is waiting for you.

Every action that changes money, accounts, contests or settings asks for a **short reason**. It is saved in the
**Audit log** with your name and the time.

### 1. Dashboard
Numbers for the last 7 days, 30 days or all time: live contests, contests started and completed, designs per contest,
client payments, platform revenue (service fees + add-ons + designer fees), withdrawals waiting, reports to check.
**Wizard drop-off** shows how many visitors reached each step of "Start a contest" — a big drop at one step means that
step needs work. **Latest admin actions** shows what admins did recently.

### 2. Contests
Search by brand name or contest number; filter by status. Open a contest to see its designs, payments and handover.
- **Edit brief** — fix a client's brief (only while open). Designers who entered are told.
- **Extend** — add 1–30 days for free (open contests only). Client and designers are told the new end date.
- **Pick winner** — choose the winner for a client who asked you to (same rules as the client's pick).
- **Cancel contest** — for fake or abusive briefs. It disappears from the site. **No refund** (no-refund policy).

### 3. Designs
- **Flagged duplicates:** designs that look almost the same as an older one, side by side.
  **Remove** if copied, or **Not a copy** to clear the flag.
- **Recently submitted:** the newest designs; **Remove** breaks the rules (the designer sees your reason).
  A winning design can't be removed here — use a copy claim.

### 4. Reports
Reports from clients and designers, with the design, the evidence image and links side by side.
- **Uphold** — the design is removed. Choose: **Permanent ban** (default for copied or AI logos), **Give a strike**, or **No penalty**.
- **Dismiss** — nothing wrong.
- **Dismiss as false** — the reporter gets a false-flag warning (3 warnings = banned).

### 5. Copy claims
A client says the **winning** design is copied (allowed for 3 days after picking; the designer's prize is frozen meanwhile).
Talk with the designer first, then:
- **Reject claim** — the prize is released as normal.
- **Uphold: correction** — the win stays; the designer must send corrected files.
- **Uphold: fine** — win cancelled, the fine is taken from the designer's wallet, the client picks another design.
- **Uphold: ban** — win cancelled, account banned, the client picks another design.

### 6. Users
Search by name, username, email or mobile. Open a person to see their strikes (who gave each and why), their contests
or designs, and wallet.
- **Give strike** — 1 = warning, 2 = suspended for 14 days (setting), 3 = permanent ban.
- **Remove** (a strike) — lowers the count; it never lifts a ban by itself.
- **Suspend** (number of days) · **Ban** · **Make active**. You can't change your own account.

### 7. Payments
Every client payment with status (Paid, Started, Failed), amount, gateway and transaction ID. Click the contest to open it.
"Check with gateway" arrives with SSLCommerz (M9).

### 8. Withdrawals
Designers' withdrawal requests that need you (bank transfers, and bKash when automatic payout is off or failed).
1. Send the money from your bKash/bank.
2. **Mark as paid** and type the transaction ID — the designer is told.
3. Or **Reject** with a reason — the money goes back to their wallet.

### 9. Agreements
Every designer's signed originality agreement: name, mobile, address, ID type and the ID number **masked** (`••••••3456`).
**Show full number** only when you really need it (for a copy case) — every reveal is logged.

### 10. Monthly winner
After a month ends, the system proposes the **most-liked winning design** of that month.
1. Open the month, look at the designs and likes, then **Pick as winner** (the proposed one or another).
2. The winner is asked for their delivery address; when it arrives, you see name, phone and address here.
3. Send the gift box, then **Mark gift as sent** with the courier name and tracking number. The winner is told.

### 11. Homepage
Choose which winning logos appear on the home page and in what order (↑ ↓ ×). With none picked, the home page shows live contests.

### 12. Blocked terms
Extra words and names the "no contact details" filter blocks (on top of its built-in rules for phone numbers, emails,
links and social handles). **Add term**, remove with ×, and use **Test the filter** to check any text.

### 13. Settings
Every number you can change without code: fees and fee tiers, package prices, add-on prices, timers (contest length,
judging days, reminders, file deadline, claim days, 12h/6h notices…), limits, social links, WhatsApp number, live chat.
Change a value, write a reason, **Save changes**. Changes apply at once and are logged.

### 14. Audit log
A read-only list of every admin action: who, what, when, and the details. Filter by action.

---

## Part F — Your routine

**Every day (10 minutes)**
- [ ] Red numbers in the menu: **Reports**, **Copy claims**, **Withdrawals** — clear them.
- [ ] **Withdrawals:** pay waiting requests and mark them paid.
- [ ] **Designs → Flagged duplicates:** remove copies.
- [ ] Answer live chat / WhatsApp.

**Every week**
- [ ] **Dashboard** (30 days): revenue, contests, wizard drop-off.
- [ ] **Homepage:** add good new winning logos.
- [ ] Run `npm run backup:db` and `npm run backup:files`; copy `backups/` off the computer.
- [ ] Glance at the **Audit log**.

**Every month (first days of the month)**
- [ ] **Monthly winner:** pick last month's winner.
- [ ] Send the gift box once the address arrives; **Mark gift as sent**.
- [ ] Review **Settings** (prices, timers) if anything should change.

---

## Part G — When something goes wrong

| Problem | What to check |
|---|---|
| Contests don't end / no reminders | The 15-minute job (Part D1). Check `cron.job_run_details` in Supabase; `CRON_SECRET` must match in Vercel and the cron job. |
| "Not found" on `/admin` | Your account isn't admin (Part C), or you're not logged in. Log out and in again. |
| Email codes / reset links don't arrive | `EMAIL_DRIVER` is still `log` (connect email in M9), or Supabase Site URL / Redirect URLs (B2). |
| Clients can't pay | SSLCommerz isn't connected yet (M9). The live site never allows the fake checkout. |
| Images don't load | Supabase keys in Vercel (B4), then redeploy. |
| A setting change did nothing | It's saved at once; refresh the page. If it's an environment variable (Vercel), redeploy. |
| Site is down after an update | Vercel → Deployments → pick the last working one → **Promote to Production** (instant rollback). Then tell me. |
| A designer says money is wrong | Users → open them → wallet balance; Withdrawals; Audit log for that person. Every taka is in the wallet history. |

**Need help?** Tell me what you see (a screenshot is perfect) — never send passwords or keys.

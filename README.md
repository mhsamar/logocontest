# logocontest.bd

Logo design contests for Bangladesh. Next.js + Supabase.

## Setup

1. `npm install`
2. Create a Supabase project. In **SQL Editor**, run every file in `supabase/migrations/` in order (0001, 0002, 0003, …).
3. `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API)
   - `OTP_SECRET` (`openssl rand -hex 32`)
   - `ADMIN_PHONE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` for the first admin
4. `npm run seed` — writes default settings and creates the admin account.
5. `npm run dev` and open http://localhost:3000

In development, SMS codes are printed to the terminal running `npm run dev`.

See `CLAUDE.md` for project rules and all commands.

## Trying the contest wizard (Milestone 2)

1. Make sure `.env.local` also has `APP_SECRET` (any long random string) and `PAYMENT_DRIVER=fake`.
2. Open http://localhost:3000/start and answer steps 1–8. Answers are autosaved in the browser.
3. Step 9 asks for a mobile number and an email (no SMS code).
4. Step 10 creates your client account and saves the contest as a draft. You can log in later with the mobile number or the email.
5. Step 11: enter your name, pick bKash or Card, accept the terms, and press **Pay**.
6. The **test checkout** page (development only) lets you choose *Pay successfully* (→ "Your contest is live") or *Simulate a failed payment* (→ "saved as a draft", with **Try again**).

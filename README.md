# logocontest.bd

Logo design contests for Bangladesh. Next.js + Supabase.

## Setup

1. `npm install`
2. Create a Supabase project. In **SQL Editor**, run every file in `supabase/migrations/` in order (0001, 0002, 0003, …).
3. `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API)
   - `OTP_SECRET` (`openssl rand -hex 32`)
   - `ADMIN_PHONE`, `ADMIN_PASSWORD` for the first admin
4. `npm run seed` — writes default settings and creates the admin account.
5. `npm run dev` and open http://localhost:3000

In development, SMS codes are printed to the terminal running `npm run dev`.

See `CLAUDE.md` for project rules and all commands.

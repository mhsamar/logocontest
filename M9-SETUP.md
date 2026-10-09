# Milestone 9 — Real services and launch checklist

What each outside service does on logocontest.bd, what we need from you, which keys go where, and how it is switched on.
Every service sits behind a "driver" setting in `.env.local` (on the live server: its environment settings). Today all of
them run in a safe test mode, so nothing real is sent or charged.

**Never paste keys, passwords or secrets into chat.** Put them straight into `.env.local` (it is never committed) or the
hosting provider's environment settings. Tell me when they are in place and I'll wire up and test the service.

---

## 1. At a glance

| Service | What it does | Code ready? | What we need from you | Setting today |
|---|---|---|---|---|
| SSLCommerz | Client payments (bKash, cards) | **No — built in M9** | SSLCommerz merchant account (store ID + store password) | `PAYMENT_DRIVER=fake` |
| Email | Confirmation codes, reset links, contest emails | **No — built in M9** | An email provider account and a verified sending domain | `EMAIL_DRIVER=log` |
| SMS | Codes and key alerts by SMS | **No — built in M9** | A Bangladeshi SMS gateway account | `SMS_DRIVER=log` |
| bKash payouts | Automatic designer withdrawals | **Partly** (gateway interface ready) | bKash merchant **payout/disbursement** credentials | `PAYOUT_DRIVER=fake` |
| Browser push | Phone/desktop notifications | **Yes** | Nothing (I can generate the keys) | `PUSH_DRIVER=log` |
| Google Vision | Logo Scan add-on, image safety check | **Yes** | A Google Cloud project with a Vision API key | `LOGO_SCAN_DRIVER=log`, `MODERATION_DRIVER=log` |
| Tawk.to | Live chat on the Help page | **Yes** | A free Tawk.to account (property ID + widget ID) | Admin → Settings → Site |
| Lifecycle job | Ends contests, reminders, payouts, Monthly Winner | **Yes** | A scheduler on the live server | runs only when called |

---

## 2. SSLCommerz (client payments) — needs code in M9

**What it does:** the checkout page where clients pay the prize, service fee and add-ons with bKash, Nagad, Rocket or a card.
A contest only goes live after SSLCommerz confirms the full amount.

**What you do:**
1. Apply for a merchant account at sslcommerz.com (trade licence, NID, bank details, website URL are usually asked).
2. You get a **sandbox** store first (for testing), then a **live** store after approval.
3. Put these in `.env.local` (I'll add the exact names to `.env.example` when I build it):
   - store ID
   - store password
   - sandbox or live mode

**What I build:**
- An `SSLCommerz` payment driver behind the existing payment interface (`PAYMENT_DRIVER=sslcommerz`).
- The callback and IPN (server-to-server confirmation) pages, checked with SSLCommerz's validation API before anything is marked paid.
- The new-contest announcement to every designer from that callback (today only the test checkout does it; the lifecycle job catches missed ones within 15 minutes).
- **Admin → Payments → "Check with gateway"** (reconcile a payment that is stuck as "Started").

**Test:** full payments in the sandbox store, including a failed and a cancelled payment.

---

## 3. Email — needs code in M9

**What it does:** sends the 6-digit email confirmation code, password reset links and contest emails (for example "contest ends in 24 hours", "Monthly Champion announced").

**What you do:**
1. Pick a provider. Good options: **Resend**, **Amazon SES** or **Brevo**. All have a free or low-cost starting tier; check current prices.
2. Verify the domain `logocontest.bd` with them (they give you DNS records to add — usually SPF, DKIM and a return-path record).
3. Choose the sender, for example `no-reply@logocontest.bd`.
4. Put the provider's API key in `.env.local`.

**What I build:** the email driver (`EMAIL_DRIVER=resend` or similar) and simple Bangla/English email templates for the existing messages.

**Also set:** `SITE_URL=https://logocontest.bd` so links in emails point to the live site.

---

## 4. SMS — needs code in M9

**What it does:** sends texts to Bangladeshi mobile numbers (codes, and the alerts marked "SMS" in BLUEPRINT §12).

**What you do:**
1. Open an account with a Bangladeshi SMS gateway (for example SSL Wireless, Alpha SMS, BulkSMSBD — check prices and delivery to all operators).
2. Register a **sender ID** (masking name such as `LOGOCONTEST`) if you want texts to show a name instead of a number; this needs approval and takes a few days.
3. Put the API key (and sender ID) in `.env.local`.

**What I build:** the SMS driver for the chosen gateway (`SMS_DRIVER=<gateway>`), with Bangla text support.

---

## 5. bKash payouts — gateway ready, needs your credentials

**What it does:** when a designer withdraws to bKash, the money is sent automatically. Without it, every withdrawal waits in
**Admin → Withdrawals** and you pay by hand, then enter the transaction ID (this already works today).

**What you do:**
1. Ask bKash for a **merchant disbursement / payout (B2C)** account. This is separate from a normal payment merchant account.
2. Put these in `.env.local`:
   - `BKASH_PAYOUT_BASE_URL`
   - `BKASH_PAYOUT_APP_KEY`
   - `BKASH_PAYOUT_APP_SECRET`
   - `BKASH_PAYOUT_USERNAME`
   - `BKASH_PAYOUT_PASSWORD`
3. Set `PAYOUT_DRIVER=bkash`.

**Until then on the live site:** `PAYOUT_DRIVER=manual` (the live site never allows `fake`).

**What I build:** the bKash API calls inside the existing payout driver, plus a test with their sandbox.

---

## 6. Browser push — ready, I can switch it on

**What it does:** notifications on phones and computers even when the site is closed (new contest, 6 hours left, you won, money released…).

**What I do (no account needed):**
1. Generate the keys with `npx web-push generate-vapid-keys`.
2. Set `PUSH_DRIVER=webpush`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT=mailto:support@logocontest.bd`.
3. Test on Android Chrome and desktop. (iPhones only get push when the site is added to the Home Screen.)

Just say "push on" and I'll do it.

---

## 7. Google Vision (Logo Scan and image safety) — ready, needs a key

**What it does:**
- **Logo Scan** (paid add-on): searches the web for logos that look like a submitted design and shows the matches to the client.
- **Image safety:** blocks nude or violent pictures in uploads.

**What you do:**
1. Create a Google Cloud project, turn on billing, and enable the **Cloud Vision API**.
2. Create an API key and restrict it to the Vision API.
3. Put it in `GOOGLE_VISION_API_KEY`, then set `LOGO_SCAN_DRIVER=google` and `MODERATION_DRIVER=google`.

Vision is charged per image; check Google's current price and set a budget alert in Google Cloud.

---

## 8. Tawk.to live chat — ready, no code

**What you do:**
1. Make a free account at tawk.to and create a property for logocontest.bd.
2. From the widget link (`https://embed.tawk.to/<property ID>/<widget ID>`), copy the two IDs.
3. In **Admin → Settings → Site**, set the chat driver to `tawk` and paste the property ID and widget ID.
4. Install the Tawk.to app on your phone to answer chats.

The Help page switches from "Coming soon" to **Start live chat** at once.

---

## 9. Before launch (not code)

- [ ] **Lawyer review** of the four legal pages and the designer originality agreement, especially the legal-action clause and storing ID numbers (BLUEPRINT §18).
- [ ] **Supabase Pro** plan for daily backups (the free plan keeps none you can download). Until then, run `npm run backup:db` and `npm run backup:files` and keep a copy off this computer.
- [ ] **Live site settings:**
  - `SITE_URL=https://logocontest.bd`
  - `CRON_SECRET` = a long random value
  - `PAYMENT_DRIVER`, `EMAIL_DRIVER`, `SMS_DRIVER`, `PAYOUT_DRIVER`, `PUSH_DRIVER` set to the real drivers above
  - a staging copy also sets `SEO_NOINDEX=true`
- [ ] **Schedule the lifecycle job:** call `GET /api/cron/lifecycle` every 15 minutes with the header `Authorization: Bearer <CRON_SECRET>` (Supabase `pg_cron` + `pg_net`, or the host's cron). Without it, contests never end on their own, reminders and new-contest alerts don't go out, held prizes aren't released and the Monthly Winner isn't proposed.
- [ ] **First admin account:** `npm run seed` with `ADMIN_PHONE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` set (or keep the admin you already have).
- [ ] **Social links and WhatsApp number** in Admin → Settings → Site.
- [ ] **Domain and hosting:** point `logocontest.bd` to the host, HTTPS on.

---

## 10. Suggested order

1. **Browser push** — no account needed, I can do it now.
2. **Tawk.to** — 10 minutes, no code.
3. **Email** — needed for real sign-ups and password resets.
4. **SSLCommerz** — needed before real clients can pay (approval can take time, so apply early).
5. **SMS**, **bKash payouts**, **Google Vision** — as the accounts come through.

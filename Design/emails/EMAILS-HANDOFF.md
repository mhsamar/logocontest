# logocontest.bd — Email templates

14 ready email files (600px, table layout, inline styles — safe for Gmail, Outlook, Apple Mail and phone apps). `templates.json` lists every file with its subject line, preheader (preview text) and variables.

| File | Sent to | When |
|---|---|---|
| otp.html | Everyone | Sign in / confirm email / reset password code |
| welcome.html | Everyone | Account created |
| contest-new.html | Designers with alerts on | New contest matches their skills (Pro gets it first + "Pro early access" note) |
| contest-invite.html | Pro designer | Client invited them |
| contest-ending.html | Designers who saved/joined | X hours before the end |
| entry-shortlisted.html | Designer | Client shortlisted their entry |
| contest-won.html | Designer | Won — prize, fee, payout, upload final files |
| client-new-entries.html | Client | New designs (daily digest, max once a day) |
| client-pick-winner.html | Client | Contest ended, pick a winner |
| chat-message.html | Client / designer | New contest chat message |
| logo-check-ready.html | Everyone | Logo check report ready |
| pro-receipt.html | Pro designer | Pro payment received |
| pro-renewal.html | Pro designer | Renewal reminder (7 and 1 days before) |
| notification.html | Everyone | General template for any other notification (title, body, optional button) |

## Rules
- Variables use `{{name}}`; `{{#if x}}…{{/if}}` blocks are optional parts (e.g. Pro note). Fill them on the server; escape all user text (names, messages).
- Every email has a plain-text version (generate it from the same data).
- Shared: `{{site_url}}`, `{{logo_url}}` (absolute PNG URL, not SVG — Outlook/Gmail do not show SVG), `{{settings_url}}`, `{{help_url}}`, `{{unsubscribe_url}}`, `{{company_address}}`.
- OTP: 6 digits, expires in `otp_minutes` (10), max 5 tries, rate limit resends; never put the OTP in the URL. OTP and security emails always send (no unsubscribe), all others respect the user's email settings.
- Images (contest/entry) must be absolute HTTPS URLs to small thumbnails (≤ 1200px wide). Never attach other people's logos from checker results.
- Money in ৳; fee % comes from the user's real fee step.
- Footer always says "We never ask for your password, OTP or payment details by email."
- Send from a verified domain (SPF, DKIM, DMARC set up) e.g. `no-reply@logocontest.bd`, reply-to `support@logocontest.bd`.
- Keys for the email provider only in server env.

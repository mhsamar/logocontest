Add the email templates for logocontest.bd from the folder emails/ and deploy straight to production (no preview step).

Read first: emails/EMAILS-HANDOFF.md, emails/templates.json, then every .html in emails/ (source of truth for layout and text).

Safety
1. Before any change: `git tag pre-emails-$(date +%Y%m%d-%H%M)` and push the tag.
2. Work on a branch. Do not change auth logic except to use the new OTP email.
3. If build, type check, lint or tests fail: STOP, do not deploy, tell me what failed.
4. Email provider keys only in server env. Never print them.

Build
- Find the email provider the site already uses (Supabase auth email, Resend, SES, etc.). Keep it. If none, use the one already in package.json or tell me which you added.
- Put the 14 templates in the codebase as server-side templates with a small render(key, data) function: fill `{{vars}}`, keep/remove `{{#if}}` blocks, HTML-escape all user text, also produce a plain-text version.
- Subjects and preheaders from templates.json.
- Replace any existing auth/OTP email with otp.html (6 digits, 10 minutes, max 5 tries, resend rate limit, code never in a URL). If Supabase Auth sends the OTP, put this HTML into the Supabase email template instead.
- Hook each email to its event (see the table in the handoff): new contest alert (Pro immediately, others after the early-access window), invite, ending reminder, shortlisted, won, client daily digest (max once a day), pick-winner reminder, chat message (max 1 email per thread per 30 min), logo check ready, Pro receipt, Pro renewal (7 and 1 days before), welcome, and notification.html for everything else.
- Respect each user's email settings; OTP and security emails always send. Every non-security email has a working unsubscribe link for that type.
- Logo: host a PNG of the site logo and use its absolute URL as {{logo_url}}.
- Log every send (user, template, status, provider message id). Retry failed sends 3 times.

Checks before deploy
- build, type check, lint, tests pass. Tests: render every template with sample data (no `{{` left, no unescaped user HTML), OTP expiry and attempt limit, digest only once per day, settings respected.
- Send each template once to a test inbox and check Gmail web + phone: images show, button works, no layout break at 390px.

Deploy to production. Reply with: the rollback tag, which email provider is used, which events now send which template, and exactly how to roll back.

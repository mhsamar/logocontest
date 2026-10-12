# logocontest.bd: visitor welcome pop-up — design + rules handoff

Put this folder in the repo at `design/visitor-popup/`. `visitor-popup.html` is a static design reference (the pop-up over a blurred page). It is not code to paste in. The logos in it are drawn samples; do not copy them, use the site's own example images or simple shapes.

## Design (match the file)
- Modal ~980px wide, rounded 32px, white, over a dark blurred backdrop. Top: lc logo, "Welcome to logocontest.bd", black round ✕.
- Two halves side by side with a round "or" between them:
  - **Left (maroon): "Need a logo? Start a contest."** short text, 3 ticks, white button **Start a contest →** (goes to client sign-up / start-contest flow).
  - **Right (cream-gold): "Good at logos? Join as a designer."** short text, 3 ticks, maroon button **Join as a designer →** (goes to designer sign-up).
- Hover: the hovered half grows a little and the other dims; light shine; button arrow slides; the small pictures fan out.
- Bottom: checkbox "Don't show this again" and link "Just browsing →" (closes).
- Phones (<820px): halves stacked, pictures hidden, full-width buttons. Close with ✕, Esc, backdrop click or "Just browsing". Focus stays inside while open; `prefers-reduced-motion` turns motion off.
- Keep the ticks honest: only mention the smartphone / gift box offers while those offers are actually running (read from the existing monthly-winner settings); otherwise hide that tick.

## Rules (owner's decision)
1. **Only for new visitors**: not logged in AND no account on this browser (no session, and no "has account" flag from a past login/sign-up on this device).
2. **Logged-in users never see it.**
3. **Never on** sign-up, login, password reset, or any auth / checkout page.
4. **Trigger**: the visitor has been on the site for **20 seconds** (count active time on the site, across pages in the same visit) **and has scrolled** on the page. Show once per visit at most.
5. **Close** (✕, Esc, backdrop, "Just browsing"): do not show again for **7 days** on that browser.
6. **"Don't show this again"** ticked: never show again on that browser.
7. Clicking either button also hides it for 7 days (they are already going to sign up).
8. Keep 20 (seconds), 7 (days) and an on/off switch in **Settings**.
9. Use first-party storage only (localStorage / a first-party cookie). No third-party trackers, no personal data.

## Admin analytics (just for information)
Add a small **"Visitor pop-up"** card in the admin Analytics page (and a line on the dashboard if it fits), with a date range (7 / 30 / 90 days):
- **Shown**: how many times it opened.
- **Clicked Start a contest** and **Clicked Join as a designer**.
- **Closed** (and how many ticked "Don't show again").
- **Sign-ups from the pop-up**: client sign-ups and designer sign-ups that started from a pop-up button.
- **Conversion**: sign-ups ÷ shown, as a %.
- A simple bar per day for Shown vs Sign-ups.
How to count: store events (`popup_shown`, `popup_click_client`, `popup_click_designer`, `popup_closed`, `popup_never`) with an anonymous random visitor id and time only. The buttons add `?src=popup` to the sign-up link; when a sign-up completes with that source (within the same visit), save `signup_source = popup` on the new user and count it. Only admins see this card. No names, emails or IPs in this table.

## Before going live
Test as: a new visitor (shows after 20 s + scroll), same visitor after closing (hidden for 7 days; test by changing the stored date), "Don't show again", a logged-in user (never), on the sign-up page (never), phone layout, Esc and focus, and that the admin card counts a test sign-up from the pop-up.

---

## Prompt for Claude Code (paste this as one message)

```
Read design/visitor-popup/VISITOR-POPUP-HANDOFF.md fully and open design/visitor-popup/visitor-popup.html. Then look at how the site handles login state, the sign-up flows for clients and designers, Settings, the admin Analytics page, and the monthly smartphone / gift box offer settings.

Do not stop to ask me questions and do not wait for my OK between steps. Make sensible choices yourself and list them at the end.

Before changing anything, make a git commit (or tag) of the current state named "before-visitor-popup" so we can roll back.

Then build:
1. The visitor pop-up exactly as in the design (split layout, hover motion, ✕, Esc, backdrop click, "Just browsing", "Don't show this again", focus trap, phone layout, prefers-reduced-motion). Offer ticks only show while those offers are running.
2. The rules: only new visitors (not logged in and no account flag on this browser); never for logged-in users; never on sign-up, login, password reset or checkout pages; show after 20 seconds of active time on the site AND after the visitor has scrolled, at most once per visit; after close or a button click hide for 7 days; "Don't show this again" hides forever on that browser. Put 20 seconds, 7 days and an on/off switch in Settings. Use first-party storage only.
3. Analytics: store anonymous events (shown, click client, click designer, closed, never) with a random visitor id and time only. Pop-up buttons add ?src=popup to the sign-up links; when a sign-up completes from that source, save signup_source = popup on the new user. Add a "Visitor pop-up" card to the admin Analytics page with a 7/30/90-day range showing shown, clicks per button, closes, sign-ups from the pop-up (client and designer), conversion %, and a small daily bar chart. Admins only. No names, emails or IPs in the event table.

Rules: never copy the sample logos from the design file; no third-party tracking; do not change how normal sign-up works except adding the source.

When done, run build, lint and any tests. Fix every error. If everything passes, deploy to production. If build or tests fail and you cannot fix them, do not deploy; tell me what failed.

After deploying, give me: how to test it as a new visitor, a short list of what changed, the choices you made, and the exact command to roll back to "before-visitor-popup".
```

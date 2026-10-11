# logocontest.bd: contest list pages redesign — design handoff

Put this folder in the repo at `design/contest-pages/`. The `.html` files are static design references. They are not code to paste in.

This replaces the earlier `design/browse-contests/` handoff. Delete that folder if it is in the repo.

| Design file | Page | Who sees it |
|---|---|---|
| `browse-contests-visitor.html` | Browse Contests | Guests (not logged in) |
| `browse-contests-designer.html` | Browse Contests | Logged-in designers |
| `my-contests-client.html` | My Contests | Logged-in clients |

Browse Contests is **one route** with two looks (guest and designer). My Contests is the client's own page.

## Rules for every step

1. Copy the layout, spacing and colours from the design files. Reuse the site's existing header, footer and shared components; the header in each design file is only a stand-in.
2. This is a redesign. Keep the existing data fetching, filters, sorting, pagination, permissions and routes. Only the presentation changes, unless a point says "new".
3. Never copy contest names, prizes, counts or numbers from the design files. Anything marked "Sample card", "Sample data", "Sample" or written in `[square brackets]` is a placeholder. Show real data, and a proper empty state when there is none.
4. Keep the contest ID format the site uses today. Do not change it to match the design files.
5. Keep the existing Bangla and English texts where a matching text exists. New texts need both languages; ask the owner to approve them.
6. Works at 390px wide with no sideways page scroll.

## A. Who sees what

| Visitor | Browse Contests | Menu |
|---|---|---|
| Guest | Visitor look. Buttons say "View contest". | Browse Contests, Design Studio, Leaderboard, How It Works, Help |
| Logged-in designer | Designer look. Buttons say "View and submit". | Browse Contests, My Designs, Design Studio, Leaderboard, How It Works, Help |
| Logged-in client | Goes to My Contests. **"Browse Contests" is not in the client menu.** | My Contests, Design Studio, Leaderboard, How It Works, Help |

Decide the look on the server from the logged-in role, so the page does not flash the wrong one.

## B. Short hero (all three pages)

- Target height on desktop about 240px; never more than 260px.
- **Guest:** label "Logo contests", one headline, one line, buttons "Start a Contest" and "How it works". On the right, two small offer cards: maroon "For clients · Win a smartphone" and cream "For designers · Win a gift box". Both go to `/leaderboard`.
- **Designer:** headline "Find your next contest", buttons "My designs" and "How it works". On the right, the cream gift box panel with real numbers: Your wins, Top designer, To lead, a progress line and a Leaderboard link.
- **Client:** headline "Your logo contests", one line that says how many contests are open and how many wait for a winner, buttons "Start a Contest" and "How it works". On the right, the maroon smartphone panel: Your contests, Top client, To lead, a progress line and a Leaderboard link.
- The panels use the same numbers as the monthly rewards feature (`design/rewards/`). If that feature is not live yet, hide the right side and let the left side use the full width.

## C. Paid add-ons: how they look and where they sit

Clients pay for these add-ons so their contest is seen first.

| Add-on | How the card looks |
|---|---|
| Featured | Gold border, gold "Featured" tag on the top edge, filled maroon button |
| Urgent | Red line on the top edge, red "Urgent" badge with a dot |
| Highlighted | Soft yellow card background |
| Private | Lock tile, black "Private · NDA" badge. Never show the brief, business name or logo; show the fixed line from the design instead |

A contest can have several add-ons at once; show all of their styles together.

**Order in the "All contests" list** (the default the owner chose):
1. Featured
2. Urgent
3. Highlighted
4. Private
5. All other contests

Inside each group, and for group 5, use the sort the visitor picked. Paid contests stay ahead even when the visitor changes the sort. Put the order in one place in the code (a list in Settings or a constant) so the owner can change it later. The small "Order in this list" line above the grid explains this to visitors.

## D. Browse Contests (guest and designer)

1. **Featured contests section** (above "All contests"): a row of up to three large cards. Each has a cover (the contest logo tile, or the lock for a private contest) with a "Featured" tag, and "Urgent" on the cover when it applies; then package and ID, the name with the add-on badges on its right, prize, button, designs / designers / days left. Show this section only when at least one featured contest is open. A featured contest also stays in the "All contests" list.
2. **Gold bar under the featured cards:**
   - Guest: "Want your contest up here?" with the add-on badges, a "Feature my contest" button (goes to starting a contest, add-ons step) and "See more featured contests".
   - Designer: "Featured contests are shown first", only the "See more featured contests" button.
   - "See more featured contests" opens the list filtered to featured contests. Hide that button when there are three or fewer.
3. **"All contests" heading** with a badge of the real open count.
4. **Control row, one line on desktop:** status tabs with real counts; quick filter buttons; search; "All businesses"; "Sort by".
   - Guest tabs: Open, Judging, Completed. Quick filters: Featured, Urgent, Ending soon, Big prize.
   - Designer tabs: Open, Joined by me (**new**: contests this designer has sent a design to), Judging, Completed. Quick filters: Featured, Urgent.
   - "Big prize" needs a threshold. Ask the owner; keep it in Settings.
   - Search is **new**: contest name and business type, on the server. Say in your plan if you would leave it for later.
   - Keep tab, filters, sort and search in the URL.
5. **Card grid:** three columns on desktop, two on tablets, one on phones. Each card: logo tile, name, ID, business type and "Started ... ago", badges, first two lines of the brief, prize, button, "X designs · Y designers", days left with a progress line. At 3 days or less the days text and the line turn orange.
6. **Designer cards only**, four extra facts under the brief: Logo style, Colours, Client last seen, Your designs (how many this designer sent and their best rating). Take style and colours from the brief; if the brief has no such field, leave that fact out rather than guessing. For a private contest the designer has not unlocked, show "Hidden until NDA". The card also shows a green "You sent N designs" badge when it applies.
7. **Bottom:** "Showing 1–N of M" with real numbers and the large maroon "Load more contests" button (or the existing pagination, restyled the same way).

## E. My Contests (client)

1. **Control row:** tabs All, Open, Pick a winner, Not paid, Completed with real counts; an orange "N need your action" chip (contests waiting for a winner plus contests not paid); search; "Sort by", default "Needs my action".
2. **One card per contest.** The status badge, the grey note, the dashed helper line and the button change with the state:

| State | Badge | Note | Helper line | Button |
|---|---|---|---|---|
| Open | Open | "N new designs since your last visit" | "Boost:" Featured, Urgent, Highlighted → add-ons purchase for this contest | Review designs |
| Ended, no winner yet | Pick your winner (gold border) | "The contest has ended. Rate your favourites, then choose the winner." | "AI logo check: N free checks left" → the copyright checker | Pick a winner |
| Not paid | Not paid yet | "Your contest is not live. Designers will see it after you pay." | "Need help paying? Call 01712028511" | Finish payment |
| Completed | Completed | "Your logo files and the copyright paper are ready to download." | "Happy with your logo? Start your next contest" | Download files |

   - Hide the Boost line when the contest already has every add-on, and show only the ones it does not have.
   - Show the AI check line only when the copyright checker is live and the contest can use it.
   - "Pick within [n] days": use the site's real rule. If there is no such rule, leave that text out and tell the owner.
3. **Last tile:** a wide dashed "Start a new contest" card that fills the rest of the row.
4. All cards in a row are the same height, with the prize and button line at the bottom.

## F. Do not break

- SEO on Browse Contests: one `h1`, page title and description, server rendering of the first page of contests.
- Speed: fixed-size, lazy-loaded logo tiles so the page does not jump.
- Privacy: a guest or another client can never see a client's My Contests data. Private contests leak nothing in the HTML or in API responses, not just on screen.
- Keyboard and screen reader use for tabs, filters and cards.

## Before going live

1. Decide: "Big prize" amount, whether to add search now, and the add-on order (default above).
2. Check on a preview deployment as a guest, a designer and a client.
3. Check with 0, 1 and many contests; with each add-on alone and all together; a private contest; a contest ending in 3 days or less; each client state.
4. Check at 390px wide.
5. Approve new Bangla and English texts.
6. Deploy to production.

---

## Prompt for Claude Code (paste this as one message)

```
Read design/contest-pages/CONTEST-PAGES-HANDOFF.md fully and open the three design files in that folder. Then look at how the current Browse Contests page and the client's contest list are built: data fetching, tabs, filters, sorting, pagination, translations, the contest card component, how add-ons (featured, urgent, highlighted, private) are stored and sorted, and how the menu changes by role.

Before writing code, give me a short plan, the database or settings changes (if any), and your questions: the "Big prize" amount, whether to add search now, whether the brief has style and colour fields, and whether there is a "pick a winner within N days" rule. Then wait for my answers.

Build in this order. After each phase run build and lint, show me what changed, and wait for my OK:
Phase 1: shared pieces: the short hero (about 240px), the contest card with all add-on styles, and the add-on ordering (Featured, Urgent, Highlighted, Private, then the rest) kept in one place.
Phase 2: Browse Contests for guests: Featured contests section, gold bar, control row with quick filters, card grid, "Load more".
Phase 3: Browse Contests for logged-in designers: gift box panel, "Joined by me" tab, the four extra facts and the "You sent N designs" badge.
Phase 4: My Contests for clients: smartphone panel, tabs, the four contest states with their helper lines and buttons, the "Start a new contest" tile; remove "Browse Contests" from the client menu.
Phase 5: empty states, URL state for filters, and checks at 390px wide as a guest, a designer and a client.

Rules: this is a redesign, so keep all existing data logic, routes and permissions; keep the contest ID format the site uses today; never copy sample names or numbers from the design files; never reveal a private contest's brief, name or logo anywhere, including API responses; keep both languages working; hide the reward panels if the monthly rewards feature is not live; do not deploy to production. I will test on a preview first.
```

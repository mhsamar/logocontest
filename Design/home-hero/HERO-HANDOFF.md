# Home page hero: showcase slider

Put this folder in the repo at `design/home-hero/`. Open `hero-design.html` in a browser to see the slider running. It is a design reference, not code to paste in.

This hero **replaces the current hero section of the home page**. Nothing else on the home page changes.

## Layout

Two columns inside the white rounded hero panel, nav bar on top as it is today.

- **Left: the showcase.** A photo of a person, with brand items floating around it: one product item, two business cards, a round logo badge, a yellow chip with the person's role and name, and a small italic caption. Under it, 4 dots and nothing else.
- **Right: the message.** The small "Logo contests · Bangladesh" pill, a big maroon headline, one line of text, the "Your business name" field with the "Get a logo" button, and three "Good to know" chips.

Below 940px the columns stack: showcase first, text under it, centred. The showcase scales as one piece (every size inside it is relative to its own width).

## The slider

4 slides. The showcase **and** the headline + text change together. The business-name field, the button and the chips never change or move.

| # | Brand | Person shown | Chip | Caption | Product item | Brand colours | Headline | Text |
|---|---|---|---|---|---|---|---|---|
| 1 | Jubilix | Designer | Designer · MH Sam | Designed this logo for Jubilix | Coffee cup | `#553534`, dark `#3A2221`, cream `#F6EFE6` | Many designers. / One perfect logo. | Tell us your business name. Bangladesh's best designers send you logo ideas, and you pick the one you love. |
| 2 | fly | Client | Client · Sumon | Got this logo for fly | Travel ticket | `#1B2436`, dark `#0F1626`, light `#F4F5F7` | One contest. / Many logo ideas. | Start a contest in a few minutes. Designers send their ideas to you, so you have real choices. |
| 3 | beep | Client | Client · Shabnam | Got this logo for beep | Shopping bag | `#E52D54`, dark `#B81B40`, light `#FFF5F7` | Pick the one / you love. | See every design side by side, ask for changes, and choose your winner. |
| 4 | Favliy | Designer | Designer · Anika | Designed this logo for Favliy | Phone screen | `#E82C54`, dark `#B21A3E`, light `#FFF5F7` | Pay safely. / Get every file. | Your money is held safe until you approve the final logo files. |

**Behaviour**
- Changes by itself every **2 seconds** (keep the time in one constant so it is easy to change).
- Soft cross-fade with a small sideways move for the showcase and a small upward move for the text, about 250ms.
- The 4 dots show the current slide (the active one is a longer maroon pill). Clicking a dot jumps to that slide.
- Pause while the mouse is over the showcase, while the business-name field is focused, and when the tab is hidden.
- With "reduce motion" switched on in the device: no auto-play, show slide 1, dots still work.
- The first slide must be fully visible on first paint, before any script runs (no blank hero, no layout shift).
- Only the first headline is the page `<h1>`. The other three are not headings.
- The cup, cards and badge float gently up and down.

## Build notes

- Make the slides data-driven: one array of slide objects (brand, role, name, caption, colours, item type, images, headline, text) and one component that renders a slide. Adding a fifth slide must need no new layout code.
- Images are in `images/`: for each brand a colour logo, a white logo and a person photo. Copy them into the site's public folder and serve them with `next/image`. Preload only slide 1's images; lazy-load the rest.
- The product items (cup, ticket, bag, phone) and the cards are drawn with CSS in the design. Keep them as CSS.
- Colours and fonts are the same as the rest of the site: brand maroon `#8B0000`, Instrument Sans for the headline, Urbanist for text.
- "Get a logo" keeps the same action the current hero button has, and the business-name field keeps passing its value into the contest wizard.
- Keep the Bangla version working: every headline, text, chip label and caption goes through the existing translation system.

## Before this goes live

The four logos, the names and the photos in this design are **sample material**. The design shows a "Sample artwork" pill for that reason.

- The logos come from other designers and from a stock-image site. They cannot be shown on the live site without a licence or the owner's permission.
- "Client · Sumon" and "Designer · Anika" read as real people who used the site. Show only real clients and designers who agreed to it.

Build the slider so the slides come from one data file (or an admin setting later), and launch with real contest winners in it. Until real ones are ready, keep the "Sample artwork" pill visible.

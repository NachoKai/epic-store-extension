# Chrome Web Store Listing

Copy/paste the sections below into the Developer Dashboard fields when you submit.

---

## Item name
Steam Info Overlay for Epic (Unofficial)

## Summary (short description, max 132 chars)
See matching Steam reviews and price right on Epic Games Store product pages. Unofficial, not affiliated with Valve or Epic.

## Detailed description
Thinking about buying a game on the Epic Games Store but want to know how it's
actually reviewed? This unofficial extension automatically finds the matching
game on Steam and shows you the key info without leaving the Epic page.

When you open any product page on store.epicgames.com, a clean panel appears with:

- Steam review scores — both Recent (last 30 days) and All-time, with the
  percentage of positive reviews and total review count
- Metacritic score (when available)
- Steam price, with a region selector so you can compare pricing across
  countries (US, EU, UK, Argentina, Brazil, Mexico, and more)
- Genres, supported platforms (Windows / Mac / Linux), the store banner image,
  and a short description
- A direct link to the matching Steam store page

The matched Steam title is always shown so you can confirm it's the right game.

Note: This is an independent, unofficial tool. It is not affiliated with,
endorsed by, or associated with Valve Corporation (Steam) or Epic Games. All
data is fetched from Steam's public store endpoints.

## Category
Shopping (alternative: Productivity)

## Language
English

---

## Privacy — required fields

### Single purpose (one sentence)
This extension displays publicly available Steam review scores and pricing for
the game shown on the current Epic Games Store product page.

### Permission justifications

- storage
  Used only to remember your selected price region between visits. No personal
  data is stored.

- Host permission: https://store.epicgames.com/*
  Required to read the game title on the page and inject the information panel
  into Epic Games Store product pages.

- Host permission: https://store.steampowered.com/*
  Required to fetch publicly available review scores, pricing, and game details
  from Steam's public store endpoints to display on the panel.

### Data usage disclosures (check these on the dashboard)
- Does NOT collect or transmit any personally identifiable information.
- Does NOT sell or transfer user data to third parties.
- Does NOT use data for purposes unrelated to the single purpose.
- No remote code is executed.

### Privacy policy URL
Host the included privacy-policy.html somewhere public (e.g. GitHub Pages,
Vercel, or any static host) and paste its URL here.
See RELEASE_CHECKLIST.md for step-by-step GitHub Pages hosting instructions.

### Support / developer contact email
ignacio.caiafa@gmail.com

---

## Screenshots (required: at least one, 1280x800 or 640x400)
Suggested shots to capture:
1. The panel open on a popular game's Epic page (e.g. Citizen Sleeper) showing
   the review split and price.
2. The region selector expanded, showing price changing between regions.
3. A page where genres, platforms, and Metacritic badge are all visible.

# Steam Info for Epic Games Store

A Chrome extension that overlays the matching **Steam review score and price** on
Epic Games Store product pages.

Example: open
[Citizen Sleeper on Epic](https://store.epicgames.com/p/citizen-sleeper-944858)
and a panel appears in the bottom-right showing the Steam rating, review count,
and current Steam price, with a link to the
[Steam page](https://store.steampowered.com/app/1578650/Citizen_Sleeper/).

## How it works

1. A **content script** runs on `store.epicgames.com`, reads the game title from
   the page (with the URL slug as a fallback), and handles Epic's single-page-app
   navigation.
2. A **background service worker** queries Steam's public endpoints:
   - `storesearch` to find the matching Steam app id by name
   - `appdetails` for the price
   - `appreviews` for the review summary (% positive + total reviews)
   Doing the fetches in the background avoids CORS restrictions.
3. The result is rendered in a small floating panel and cached for 6 hours.

## Install (Load Unpacked)

1. Open `chrome://extensions` in Chrome (or any Chromium browser).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select this `epic-steam-extension` folder.
5. Visit any Epic Games Store product page (a `/p/...` URL).

## Notes & limitations

- Matching is name-based, so a different edition or a slightly different title
  may occasionally match the wrong app. The panel shows which Steam title it
  matched so you can verify.
- Steam's endpoints are unofficial and may change or rate-limit.
- Prices are fetched in USD (`cc=us`). Change `cc=us` in `background.js` to use a
  different region.

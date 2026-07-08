# epic-store-extension

Unofficial Chrome extension that overlays matching **Steam review scores and
pricing** on Epic Games Store product pages — so you can check how a game is
actually rated on Steam without leaving Epic.

![Manifest V3](https://img.shields.io/badge/manifest-v3-blue)
![License](https://img.shields.io/badge/license-unspecified-lightgrey)

## What it does

Open any game page on `store.epicgames.com/p/...` and a floating panel appears
with:

- Steam review scores — Recent (last 30 days) and All-time, % positive + total count
- Metacritic score (when available)
- Steam price, with a region selector (US, EU, UK, AR, BR, MX, and more)
- Genres, supported platforms (Windows/Mac/Linux), store banner, short description
- A direct link to the matched Steam store page (the matched title is always
  shown so you can confirm it's the right game)

## Repo layout

The extension is self-contained under `epic-steam-extension/` — see
[`epic-steam-extension/README.md`](epic-steam-extension/README.md) for how it
works internally, and
[`epic-steam-extension/STORE_LISTING.md`](epic-steam-extension/STORE_LISTING.md)
for the Chrome Web Store listing copy.

## How it works

1. A **content script** (`content.js`) runs on Epic product pages, reads the
   game title (falling back to the URL slug), and re-runs on Epic's SPA
   navigation.
2. A **background service worker** (`background.js`) queries Steam's public
   endpoints — `storesearch` to find the matching app id, `appdetails` for
   price/genres/platforms, `appreviews` for the review summary — from the
   background to avoid CORS issues.
3. Results are rendered in a floating panel and cached for 6 hours.

## Install (unpacked, for development)

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select the `epic-steam-extension` folder.
3. Visit any Epic Games Store product page (`/p/...`).

## Limitations

- Matching is name-based; a different edition or similarly-named title can
  occasionally match the wrong Steam app (the matched title is shown so you
  can verify).
- Steam's endpoints are unofficial/undocumented and may change or rate-limit.
- Not affiliated with, endorsed by, or associated with Valve or Epic Games.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your selected price region between visits. No personal data stored. |
| `host_permissions: store.epicgames.com` | Read the game title, inject the panel. |
| `host_permissions: store.steampowered.com` | Fetch public review/price data. |

No remote code execution, no data collection, no third-party transmission.

![screenshot](https://github.com/NachoKai/epic-store-extension/blob/main/public/Captura%20de%20pantalla%202026-07-07%20230206.png)

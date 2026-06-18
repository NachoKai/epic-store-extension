// Background service worker (MV3).
// Handles all calls to Steam's public endpoints. Fetching from here (instead of
// the content script) avoids CORS problems, since the extension has
// host_permissions for store.steampowered.com.

const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

// --- helpers ---------------------------------------------------------------

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/['’":!?,.\-_]/g, " ")
    .replace(/\b(the|a|an|edition|deluxe|definitive|goty|game of the year)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJSON(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return res.json();
}

// Find the best matching Steam app id for a given game title.
async function findAppId(title) {
  const term = encodeURIComponent(title);
  const data = await fetchJSON(
    `https://store.steampowered.com/api/storesearch/?term=${term}&cc=us&l=english`
  );

  const items = (data && data.items) || [];
  if (items.length === 0) return null;

  const target = normalize(title);

  // 1) exact normalized match
  let match = items.find((it) => normalize(it.name) === target);
  // 2) one name contained in the other
  if (!match) {
    match = items.find((it) => {
      const n = normalize(it.name);
      return n.includes(target) || target.includes(n);
    });
  }
  // 3) fall back to the top result
  if (!match) match = items[0];

  return { id: match.id, name: match.name };
}

async function getAppDetails(appId) {
  const data = await fetchJSON(
    `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`
  );
  const entry = data && data[appId];
  if (!entry || !entry.success) return null;
  return entry.data;
}

async function getReviewSummary(appId) {
  const data = await fetchJSON(
    `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`
  );
  if (!data || data.success !== 1) return null;
  return data.query_summary || null;
}

async function buildInfo(title) {
  const match = await findAppId(title);
  if (!match) return { found: false };

  const [details, reviews] = await Promise.all([
    getAppDetails(match.id).catch(() => null),
    getReviewSummary(match.id).catch(() => null),
  ]);

  let price = null;
  if (details) {
    if (details.is_free) {
      price = { isFree: true };
    } else if (details.price_overview) {
      const p = details.price_overview;
      price = {
        isFree: false,
        final: p.final_formatted,
        initial: p.initial_formatted,
        discountPercent: p.discount_percent || 0,
      };
    }
  }

  let reviewInfo = null;
  if (reviews && reviews.total_reviews > 0) {
    const total = reviews.total_reviews;
    const positive = reviews.total_positive || 0;
    reviewInfo = {
      desc: reviews.review_score_desc,
      total,
      positive,
      percentPositive: Math.round((positive / total) * 100),
    };
  }

  return {
    found: true,
    appId: match.id,
    name: (details && details.name) || match.name,
    headerImage: details && details.header_image,
    releaseDate: details && details.release_date && details.release_date.date,
    storeUrl: `https://store.steampowered.com/app/${match.id}/`,
    price,
    review: reviewInfo,
  };
}

// --- caching ---------------------------------------------------------------

async function getCached(key) {
  const stored = await chrome.storage.local.get(key);
  const entry = stored[key];
  if (entry && Date.now() - entry.t < CACHE_TTL_MS) return entry.v;
  return null;
}

async function setCached(key, value) {
  await chrome.storage.local.set({ [key]: { t: Date.now(), v: value } });
}

// --- message handling ------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "GET_STEAM_INFO") {
    const title = (msg.title || "").trim();
    const cacheKey = "steam:" + normalize(title);

    (async () => {
      try {
        if (!title) return sendResponse({ ok: false, error: "No title" });

        const cached = await getCached(cacheKey);
        if (cached) return sendResponse({ ok: true, data: cached, cached: true });

        const data = await buildInfo(title);
        await setCached(cacheKey, data);
        sendResponse({ ok: true, data });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();

    return true; // keep the message channel open for the async response
  }
});

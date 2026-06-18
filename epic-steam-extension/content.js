// Content script: runs on store.epicgames.com.
// Detects the current game, asks the background worker for Steam info,
// and renders a floating panel with the review score and price.

(function () {
  const PANEL_ID = "steam-info-epic-panel";
  let currentTitle = null;
  let currentData = null;

  // Steam regions for pricing. Steam applies regional prices per country,
  // so the price you see depends on your account's region, not your browser.
  const REGIONS = [
    { cc: "us", label: "United States (USD)" },
    { cc: "ar", label: "Argentina (USD reg.)" },
    { cc: "br", label: "Brazil (BRL)" },
    { cc: "mx", label: "Mexico (MXN)" },
    { cc: "cl", label: "Chile (CLP)" },
    { cc: "co", label: "Colombia (COP)" },
    { cc: "ca", label: "Canada (CAD)" },
    { cc: "gb", label: "United Kingdom (GBP)" },
    { cc: "de", label: "Eurozone (EUR)" },
    { cc: "tr", label: "Türkiye (USD reg.)" },
    { cc: "in", label: "India (INR)" },
    { cc: "au", label: "Australia (AUD)" },
    { cc: "jp", label: "Japan (JPY)" },
  ];
  const DEFAULT_CC = "us";
  let region = DEFAULT_CC;

  function loadRegion() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get("sie_region", (res) => {
          if (res && res.sie_region) region = res.sie_region;
          resolve(region);
        });
      } catch {
        resolve(region);
      }
    });
  }

  function saveRegion(cc) {
    region = cc;
    try {
      chrome.storage.local.set({ sie_region: cc });
    } catch {}
  }

  // --- title detection -----------------------------------------------------

  function titleFromSlug() {
    // e.g. /p/citizen-sleeper-944858  ->  "citizen sleeper"
    const m = location.pathname.match(/\/p\/([^/?#]+)/);
    if (!m) return null;
    return m[1]
      .replace(/-[0-9a-f]{6,}$/i, "") // strip trailing id segment
      .replace(/-/g, " ")
      .trim();
  }

  function getGameTitle() {
    // Prefer the on-page H1 (most accurate), fall back to the URL slug.
    const h1 = document.querySelector("h1");
    if (h1 && h1.textContent && h1.textContent.trim().length > 1) {
      return h1.textContent.trim();
    }
    return titleFromSlug();
  }

  function isProductPage() {
    return /\/p\//.test(location.pathname);
  }

  // Wait for the H1 to render (Epic is a SPA that hydrates content async).
  function waitForTitle(timeoutMs = 8000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const t = getGameTitle();
        const h1 = document.querySelector("h1");
        if (h1 && t) return resolve(t);
        if (Date.now() - start > timeoutMs) return resolve(t || titleFromSlug());
        setTimeout(tick, 250);
      };
      tick();
    });
  }

  // --- panel rendering -----------------------------------------------------

  function removePanel() {
    const el = document.getElementById(PANEL_ID);
    if (el) el.remove();
  }

  function ensurePanel() {
    let el = document.getElementById(PANEL_ID);
    if (el) return el;
    el = document.createElement("div");
    el.id = PANEL_ID;
    el.className = "sie-panel";
    el.innerHTML = `
      <div class="sie-header">
        <span class="sie-brand">
          <svg class="sie-steam-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M11.98 2C6.66 2 2.3 6.13 2.02 11.38l5.36 2.22a2.81 2.81 0 0 1 1.6-.5l.12.01 2.38-3.46v-.05a3.76 3.76 0 1 1 3.76 3.76h-.09l-3.4 2.43.01.1a2.83 2.83 0 0 1-5.62.4l-3.83-1.59A10 10 0 1 0 11.98 2zM9.3 17.18l-1.23-.51a2.12 2.12 0 0 0 3.92-1.6 2.12 2.12 0 0 0-2.77-1.13l1.27.53a1.56 1.56 0 1 1-1.19 2.88zm6.97-7.06a2.5 2.5 0 1 0 0-5.01 2.5 2.5 0 0 0 0 5.01zm0-.78a1.72 1.72 0 1 1 0-3.44 1.72 1.72 0 0 1 0 3.44z"/>
          </svg>
          <span class="sie-logo">STEAM</span>
        </span>
        <button class="sie-close" title="Hide" aria-label="Hide">&times;</button>
      </div>
      <div class="sie-banner-wrap"></div>
      <div class="sie-body"></div>
    `;
    document.body.appendChild(el);
    el.querySelector(".sie-close").addEventListener("click", () => removePanel());
    return el;
  }

  function setBody(html) {
    const el = ensurePanel();
    el.querySelector(".sie-body").innerHTML = html;
  }

  function setBanner(html) {
    const el = ensurePanel();
    el.querySelector(".sie-banner-wrap").innerHTML = html || "";
  }

  function metacriticClass(score) {
    if (score >= 75) return "sie-mc-high";
    if (score >= 50) return "sie-mc-mid";
    return "sie-mc-low";
  }

  const PLATFORM_ICONS = {
    windows:
      '<svg viewBox="0 0 24 24" width="13" height="13" aria-label="Windows"><path fill="currentColor" d="M3 5.5 10.5 4.4v7.1H3V5.5zM3 12.5h7.5v7.1L3 18.5v-6zM11.5 4.2 21 3v8.5h-9.5V4.2zM11.5 12.5H21V21l-9.5-1.3v-7.2z"/></svg>',
    mac:
      '<svg viewBox="0 0 24 24" width="13" height="13" aria-label="macOS"><path fill="currentColor" d="M16.5 12.6c0-2 1.6-2.9 1.7-3-0.9-1.4-2.4-1.5-2.9-1.6-1.2-0.1-2.4 0.7-3 0.7-0.6 0-1.6-0.7-2.6-0.7-1.3 0-2.6 0.8-3.3 2-1.4 2.5-0.4 6.1 1 8.1 0.7 1 1.4 2.1 2.5 2 1-0.1 1.3-0.7 2.5-0.7s1.5 0.7 2.6 0.6c1.1 0 1.7-1 2.4-2 0.7-1.1 1-2.2 1-2.3-0.1 0-1.9-0.7-1.9-2.8zM14.6 6.6c0.5-0.7 0.9-1.6 0.8-2.6-0.8 0-1.7 0.5-2.3 1.2-0.5 0.6-0.9 1.5-0.8 2.5 0.9 0 1.8-0.5 2.3-1.1z"/></svg>',
    linux:
      '<svg viewBox="0 0 24 24" width="13" height="13" aria-label="Linux"><path fill="currentColor" d="M12 2c-2 0-3 1.8-3 4 0 1.3 0.3 2 0.3 3 0 1.2-1.6 2.6-2.3 4.6-0.7 2-1.3 3.4-0.5 4.3 0.4 0.4 1 0.3 1.5 0.6 0.5 0.3 0.8 0.9 1.6 1.1 0.4 0.1 0.9 0.1 1.4 0.1s1 0 1.4-0.1c0.8-0.2 1.1-0.8 1.6-1.1 0.5-0.3 1.1-0.2 1.5-0.6 0.8-0.9 0.2-2.3-0.5-4.3-0.7-2-2.3-3.4-2.3-4.6 0-1 0.3-1.7 0.3-3 0-2.2-1-4-3-4zm-1.2 4.2c0.4 0 0.7 0.4 0.7 0.9s-0.3 0.9-0.7 0.9-0.7-0.4-0.7-0.9 0.3-0.9 0.7-0.9zm2.4 0c0.4 0 0.7 0.4 0.7 0.9s-0.3 0.9-0.7 0.9-0.7-0.4-0.7-0.9 0.3-0.9 0.7-0.9z"/></svg>',
  };

  function platformsHtml(p) {
    if (!p) return "";
    const icons = [];
    if (p.windows) icons.push(`<span class="sie-plat">${PLATFORM_ICONS.windows}</span>`);
    if (p.mac) icons.push(`<span class="sie-plat">${PLATFORM_ICONS.mac}</span>`);
    if (p.linux) icons.push(`<span class="sie-plat">${PLATFORM_ICONS.linux}</span>`);
    return icons.length ? `<span class="sie-platforms">${icons.join("")}</span>` : "";
  }

  function ratingClass(percent) {
    if (percent >= 80) return "sie-pos";
    if (percent >= 50) return "sie-mixed";
    return "sie-neg";
  }

  // A single review summary line (label + % + desc + count).
  function reviewLine(label, r) {
    if (!r) {
      return `<div class="sie-review-line sie-muted"><span class="sie-review-label">${label}</span><span>No data</span></div>`;
    }
    return `
      <div class="sie-review-line">
        <span class="sie-review-label">${label}</span>
        <span class="sie-rating-pill ${ratingClass(r.percentPositive)}">${r.percentPositive}%</span>
        <span class="sie-review-detail">
          <span class="sie-rating-desc">${escapeHtml(r.desc)}</span>
          <span class="sie-rating-count">${r.total.toLocaleString()} reviews</span>
        </span>
      </div>`;
  }

  function regionSelectorHtml() {
    const opts = REGIONS.map(
      (r) =>
        `<option value="${r.cc}"${r.cc === region ? " selected" : ""}>${escapeHtml(r.label)}</option>`
    ).join("");
    return `
      <div class="sie-region">
        <label class="sie-region-label" for="sie-region-select">Price region</label>
        <select id="sie-region-select" class="sie-region-select">${opts}</select>
      </div>`;
  }

  function renderLoading(title) {
    setBanner("");
    setBody(`<div class="sie-loading">Looking up “${escapeHtml(title)}” on Steam…</div>`);
  }

  function renderNotFound(title) {
    setBanner("");
    setBody(
      `<div class="sie-notfound">No Steam match found for<br><strong>${escapeHtml(
        title
      )}</strong></div>`
    );
  }

  function renderError(msg) {
    setBanner("");
    setBody(`<div class="sie-notfound">Couldn't load Steam data.<br><small>${escapeHtml(msg)}</small></div>`);
  }

  function renderData(d) {
    // Banner image (Steam header capsule).
    if (d.headerImage) {
      setBanner(
        `<a href="${d.storeUrl}" target="_blank" rel="noopener" class="sie-banner-link">
           <img class="sie-banner" src="${d.headerImage}" alt="${escapeHtml(d.name)} on Steam" />
         </a>`
      );
    } else {
      setBanner("");
    }

    const metacriticHtml = d.metacritic
      ? `<a class="sie-metacritic ${metacriticClass(d.metacritic.score)}" href="${
          d.metacritic.url || d.storeUrl
        }" target="_blank" rel="noopener" title="Metacritic score">${d.metacritic.score}</a>`
      : "";

    const review = d.review
      ? `
        <div class="sie-reviews">
          <div class="sie-reviews-lines">
            ${reviewLine("Recent", d.recentReview)}
            ${reviewLine("All-time", d.review)}
          </div>
          ${metacriticHtml}
        </div>`
      : `<div class="sie-row sie-muted">No Steam reviews yet ${metacriticHtml}</div>`;

    const descHtml = d.shortDescription
      ? `<p class="sie-desc">${escapeHtml(d.shortDescription)}</p>`
      : "";

    let priceHtml = "";
    if (d.price) {
      if (d.price.isFree) {
        priceHtml = `<div class="sie-price"><span class="sie-price-final">Free</span></div>`;
      } else if (d.price.discountPercent > 0) {
        priceHtml = `
          <div class="sie-price">
            <span class="sie-discount">-${d.price.discountPercent}%</span>
            <span class="sie-price-initial">${escapeHtml(d.price.initial || "")}</span>
            <span class="sie-price-final">${escapeHtml(d.price.final || "")}</span>
          </div>`;
      } else {
        priceHtml = `<div class="sie-price"><span class="sie-price-final">${escapeHtml(
          d.price.final || ""
        )}</span></div>`;
      }
    }

    const genresHtml =
      d.genres && d.genres.length
        ? `<div class="sie-genres">${d.genres
            .map((g) => `<span class="sie-chip">${escapeHtml(g)}</span>`)
            .join("")}</div>`
        : "";

    const matchNote =
      `<div class="sie-match">` +
      `<span>Matched: <strong>${escapeHtml(d.name)}</strong>` +
      (d.releaseDate ? ` · ${escapeHtml(d.releaseDate)}` : "") +
      `</span>` +
      platformsHtml(d.platforms) +
      `</div>`;

    setBody(`
      ${review}
      ${descHtml}
      ${priceHtml}
      ${regionSelectorHtml()}
      ${genresHtml}
      ${matchNote}
      <a class="sie-link" href="${d.storeUrl}" target="_blank" rel="noopener">View on Steam →</a>
    `);

    const sel = document.getElementById("sie-region-select");
    if (sel) {
      sel.addEventListener("change", (e) => {
        saveRegion(e.target.value);
        // Re-fetch with the new region for the current title.
        if (currentTitle) requestInfo(currentTitle);
      });
    }
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // --- main flow -----------------------------------------------------------

  async function run() {
    if (!isProductPage()) {
      removePanel();
      currentTitle = null;
      return;
    }

    const title = await waitForTitle();
    if (!title) {
      currentTitle = null;
      return;
    }
    if (title === currentTitle && document.getElementById(PANEL_ID)) return;
    currentTitle = title;

    requestInfo(title);
  }

  // Fetch Steam info for a title using the currently selected region.
  function requestInfo(title) {
    renderLoading(title);

    chrome.runtime.sendMessage({ type: "GET_STEAM_INFO", title, cc: region }, (resp) => {
      if (chrome.runtime.lastError) {
        renderError(chrome.runtime.lastError.message);
        return;
      }
      if (!resp || !resp.ok) {
        renderError((resp && resp.error) || "Unknown error");
        return;
      }
      if (!resp.data || !resp.data.found) {
        renderNotFound(title);
        return;
      }
      currentData = resp.data;
      renderData(resp.data);
    });
  }

  // --- SPA navigation handling ---------------------------------------------

  let lastUrl = location.href;
  function onMaybeNavigate() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      currentTitle = null;
      removePanel();
      run();
    }
  }

  // Watch DOM mutations to catch client-side route changes.
  const mo = new MutationObserver(() => onMaybeNavigate());
  mo.observe(document, { subtree: true, childList: true });

  // Also patch history API for instant detection.
  for (const fn of ["pushState", "replaceState"]) {
    const orig = history[fn];
    history[fn] = function () {
      const r = orig.apply(this, arguments);
      setTimeout(onMaybeNavigate, 0);
      return r;
    };
  }
  window.addEventListener("popstate", onMaybeNavigate);

  // Load the saved region first, then start.
  loadRegion().then(run);
})();

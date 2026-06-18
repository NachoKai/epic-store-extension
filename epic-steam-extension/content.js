// Content script: runs on store.epicgames.com.
// Detects the current game, asks the background worker for Steam info,
// and renders a floating panel with the review score and price.

(function () {
  const PANEL_ID = "steam-info-epic-panel";
  let currentTitle = null;

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
        <span class="sie-logo">STEAM</span>
        <button class="sie-close" title="Hide" aria-label="Hide">&times;</button>
      </div>
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

  function ratingClass(percent) {
    if (percent >= 80) return "sie-pos";
    if (percent >= 50) return "sie-mixed";
    return "sie-neg";
  }

  function renderLoading(title) {
    setBody(`<div class="sie-loading">Looking up “${escapeHtml(title)}” on Steam…</div>`);
  }

  function renderNotFound(title) {
    setBody(
      `<div class="sie-notfound">No Steam match found for<br><strong>${escapeHtml(
        title
      )}</strong></div>`
    );
  }

  function renderError(msg) {
    setBody(`<div class="sie-notfound">Couldn't load Steam data.<br><small>${escapeHtml(msg)}</small></div>`);
  }

  function renderData(d) {
    const review = d.review
      ? `
        <div class="sie-row">
          <div class="sie-rating ${ratingClass(d.review.percentPositive)}">
            ${d.review.percentPositive}%
          </div>
          <div class="sie-rating-meta">
            <div class="sie-rating-desc">${escapeHtml(d.review.desc)}</div>
            <div class="sie-rating-count">${d.review.total.toLocaleString()} reviews</div>
          </div>
        </div>`
      : `<div class="sie-row sie-muted">No Steam reviews yet</div>`;

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

    const matchNote =
      `<div class="sie-match">Matched: <strong>${escapeHtml(d.name)}</strong>` +
      (d.releaseDate ? ` · ${escapeHtml(d.releaseDate)}` : "") +
      `</div>`;

    setBody(`
      ${review}
      ${priceHtml}
      ${matchNote}
      <a class="sie-link" href="${d.storeUrl}" target="_blank" rel="noopener">View on Steam →</a>
    `);
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

    renderLoading(title);

    chrome.runtime.sendMessage({ type: "GET_STEAM_INFO", title }, (resp) => {
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

  run();
})();

import type { Context } from '@/core/engine';
import { extractContext, isAllowed } from '@/core/engine';
import { getStorage } from '@/storage';
import type { Whitelist, OverrideState } from '@/storage/types';

// Content script: runs on allowed YouTube pages
// Monitors DOM and hides non-whitelisted items in filtered mode

const BLOCK_PAGE = chrome.runtime.getURL('src/ui/block/index.html');

console.log('[Lockin] Content script starting on URL:', window.location.href);

// ─── Filtered mode — DOM Interception ─────────────────────────────────────────

const TARGETS = [
  // Video renderers
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-playlist-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer', // Legacy channel pages
  'ytd-channel-video-renderer',
  'yt-lockup-view-model', // Newer YouTube component wrapper
  
  // Shorts and shelves
  'ytd-reel-item-renderer',
  'ytd-rich-section-renderer', // Shorts shelves / Trending shelves
  'ytd-reel-shelf-renderer',
  'ytd-shelf-renderer', // Search result shelves
  'ytd-horizontal-card-list-renderer', // Alternative search result shelf
  'ytd-shorts', // The shorts player itself
  
  // Navigation
  'ytd-guide-entry-renderer', // Sidebar links
  'ytd-mini-guide-entry-renderer',

  // Ads
  'ytd-ad-slot-renderer',
  'ytd-in-feed-ad-layout-renderer',
  'ytd-banner-promo-renderer',
  'ytd-promoted-sparkles-web-renderer'
];

const TARGETS_SELECTOR = TARGETS.join(', ');

/**
 * Forceful check to redirect the user if they directly navigate to a Short in Filtered mode.
 * This prevents the video from playing audio while being visually hidden.
 */
function enforceFilteredModeNavigation() {
  if (window.location.pathname.startsWith('/shorts')) {
    const from = encodeURIComponent(window.location.href);
    const reason = encodeURIComponent('Shorts are not allowed');
    window.location.replace(`${BLOCK_PAGE}?from=${from}&reason=${reason}`);
  }
}

/**
 * Attempt to extract URL context from a DOM element (video tile).
 * We look for the main watch/playlist anchor, and optionally the channel anchor.
 */
function buildContext(el: Element): Context | null {
  // The main shorts viewer doesn't contain a link to itself.
  if (el.tagName.toLowerCase() === 'ytd-shorts') {
    return extractContext(window.location.href);
  }

  // ── 1. Main content link (video / shorts / playlist) ──────────────────────
  let contentAnchor: HTMLAnchorElement | null = null;
  const anchors = Array.from(el.querySelectorAll<HTMLAnchorElement>('a'));
  
  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    if (href.includes('/shorts') || href.includes('/watch') || href.includes('/playlist')) {
      contentAnchor = a;
      break;
    }
  }

  if (!contentAnchor) return null;

  const raw = contentAnchor.getAttribute('href') ?? '';
  const fullUrl = raw.startsWith('http') ? raw : `https://www.youtube.com${raw}`;
  let ctx = extractContext(fullUrl);

  // ── 2. Channel link ───────────────────────────────────────────────────────
  // Context from the main link usually won't have the channelId unless it's a channel URL.
  // We need to scrape the secondary anchor on the tile for the channel.
  if (!ctx.channelId) {
    const channelAnchor =
      el.querySelector<HTMLAnchorElement>('a[href^="/@"]') ??
      el.querySelector<HTMLAnchorElement>('a[href*="/channel/UC"]');

    if (channelAnchor) {
      const chRaw = channelAnchor.getAttribute('href') ?? '';
      const chUrl = chRaw.startsWith('http') ? chRaw : `https://www.youtube.com${chRaw}`;
      const chCtx = extractContext(chUrl);
      // Merge channelId into the existing context
      ctx = { ...ctx, channelId: chCtx.channelId };
    } else {
      // Fallback: If we are ON a channel page, the individual video tiles often omit the channel link.
      // We can use the current page's URL to infer the channel.
      const currentUrlCtx = extractContext(window.location.href);
      if (currentUrlCtx.channelId) {
        ctx = { ...ctx, channelId: currentUrlCtx.channelId };
      }
    }
  }

  return ctx;
}

function filterElement(el: Element, whitelist: Whitelist, override?: OverrideState): void {
  // Already hidden — nothing to do
  if ((el as HTMLElement).style.display === 'none') return;

  const tagName = el.tagName.toLowerCase();
  const isSearchPage = window.location.pathname.startsWith('/results');

  // We log specifically on the search page if it looks like a Shorts-related component
  if (isSearchPage && tagName.includes('shelf') || tagName.includes('horizontal') || tagName.includes('reel') || tagName.includes('lockup')) {
     console.log(`[Lockin-Debug] Inspecting search component: <${tagName}>`, el);
  }

  // Unconditionally hide ads and Shorts-exclusive components
  const isAdOrShorts = ['ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-banner-promo-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-reel-shelf-renderer', 'ytd-reel-item-renderer']
    .includes(tagName) || el.querySelector('.ytd-ad-slot-renderer, [class*="ad-slot"]');

  if (isAdOrShorts) {
    if (isSearchPage) console.log(`[Lockin-Debug] Unconditionally hiding Ad/Shorts: <${tagName}>`);
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
    return;
  }

  // Unconditionally hide sidebar Shorts links
  if (tagName === 'ytd-guide-entry-renderer' || tagName === 'ytd-mini-guide-entry-renderer') {
    const a = el.querySelector('a');
    if (a && (a.getAttribute('title') === 'Shorts' || (a.getAttribute('href') || '').includes('/shorts'))) {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
      return;
    }
  }

  // Unconditionally hide Home page Shorts shelves (ytd-rich-section-renderer)
  if (tagName === 'ytd-rich-section-renderer') {
    if (el.hasAttribute('is-shorts') || el.querySelector('[is-shorts]') || el.querySelector('yt-icon.ytd-logo[icon="yt-shorts"]')) {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
      return;
    }
  }

  // Unconditionally hide Search page Shorts shelves
  if (tagName === 'ytd-shelf-renderer' || tagName === 'ytd-horizontal-card-list-renderer') {
    const title = el.querySelector('#title')?.textContent?.trim();
    const hasIcon = !!el.querySelector('yt-icon[icon="yt-shorts"], .ytd-shorts-logo, svg path[d^="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33"]');

    if (isSearchPage) {
      console.log(`[Lockin-Debug] Search Shelf Check <${tagName}> -> title: "${title}", hasShortsIcon: ${hasIcon}`);
    }

    if (title === 'Shorts' || hasIcon) {
      console.log(`[Lockin-Debug] HIDING Search Shelf <${tagName}>`);
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
      return;
    }
  }

  const ctx = buildContext(el);
  if (!ctx) {
    if (isSearchPage && (tagName.includes('reel') || tagName.includes('lockup'))) {
      console.log(`[Lockin-Debug] Skipping <${tagName}> because context could not be built (no anchor yet?).`);
    }
    return; // can't resolve → skip, don't hide
  }

  if (!isAllowed(ctx, whitelist, 'filtered', override)) {
    if (isSearchPage) {
      console.log(`[Lockin-Debug] HIDING video tile <${tagName}> (isShort: ${ctx.isShort}, url: ${ctx.url})`);
    }
    (el as HTMLElement).style.setProperty('display', 'none', 'important');

    // Fallback: If we just hid a Short inside a shelf, hide the entire shelf container to prevent empty "Shorts" sections.
    if (ctx.isShort) {
      const section = el.closest('ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytd-shelf-renderer, ytd-horizontal-card-list-renderer');
      if (section) {
        console.log(`[Lockin-Debug] Also HIDING parent container of Short: <${section.tagName.toLowerCase()}>`);
        (section as HTMLElement).style.setProperty('display', 'none', 'important');
      }
    }
  } else {
    if (isSearchPage && ctx.isShort) {
      console.log(`[Lockin-Debug] WARNING: A Short is marked as ALLOWED? <${tagName}> (url: ${ctx.url})`);
    }
  }
}

function filterAllTiles(whitelist: Whitelist, override?: OverrideState): void {
  document.querySelectorAll(TARGETS_SELECTOR).forEach((el) => {
    // Reset any previous hide so we can re-evaluate with a potentially changed whitelist
    (el as HTMLElement).style.display = '';
    filterElement(el, whitelist, override);
  });
}

function attachObserver(whitelist: Whitelist, override?: OverrideState) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        // 1. If the added node IS a target tile or contains target tiles
        for (const sel of TARGETS) {
          if (node.matches(sel)) {
            // Execute synchronously to prevent visual flicker
            filterElement(node, whitelist, override);
          }
          node.querySelectorAll(sel).forEach((el) => {
            filterElement(el, whitelist, override);
          });
        }

        // 2. If the added node was inserted INSIDE an existing tile
        // (YouTube renders custom elements asynchronously, so the tile is
        // often injected empty, and its anchor tags are added moments later).
        const parentTile = node.closest(TARGETS_SELECTOR);
        if (parentTile) {
          filterElement(parentTile, whitelist, override);
        }
      }
    }
  });

  observer.observe(document.documentElement || document, { childList: true, subtree: true });
}

function injectGlobalStyles() {
  if (document.getElementById('lockin-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'lockin-global-styles';
  style.textContent = `
    /* Nuclear option for Shorts - Pure CSS */
    a[href*="/shorts/"] {
      display: none !important;
    }
    
    ytd-rich-item-renderer:has(a[href*="/shorts/"]),
    ytd-video-renderer:has(a[href*="/shorts/"]),
    ytd-playlist-video-renderer:has(a[href*="/shorts/"]),
    ytd-compact-video-renderer:has(a[href*="/shorts/"]),
    ytd-grid-video-renderer:has(a[href*="/shorts/"]),
    ytd-channel-video-renderer:has(a[href*="/shorts/"]),
    yt-lockup-view-model:has(a[href*="/shorts/"]),
    ytd-reel-item-renderer,
    ytd-reel-shelf-renderer,
    ytd-rich-section-renderer:has(a[href*="/shorts/"]),
    ytd-rich-section-renderer:has(yt-icon[icon="yt-shorts"]),
    ytd-rich-section-renderer:has([is-shorts]),
    ytd-shelf-renderer:has(a[href*="/shorts/"]),
    ytd-horizontal-card-list-renderer:has(a[href*="/shorts/"]) {
      display: none !important;
    }

    /* Sidebar Shorts */
    ytd-guide-entry-renderer:has(a[title="Shorts"]),
    ytd-guide-entry-renderer:has(a[href*="/shorts/"]),
    ytd-mini-guide-entry-renderer:has(a[title="Shorts"]),
    ytd-mini-guide-entry-renderer:has(a[href*="/shorts/"]) {
      display: none !important;
    }
  `;
  // Inject early before body is ready if possible
  (document.head || document.documentElement).appendChild(style);
}

// ─── Strict mode — Flicker guard ──────────────────────────────────────────────
// Hides the YouTube video player immediately while the SW verdict round-trip
// completes. Critically: has an 800ms hard failsafe so the page never stays
// invisible forever if the SW is evicted or the message is dropped.
// Fail-open on paint is correct — fail-closed is the decision engine's job.

let flickerGuardTimer: ReturnType<typeof setTimeout> | null = null;
let guardDroppedEarly = false;
let failsafeCeiling = 800; // Calibrated adaptively by updateFailsafeCeiling()

function injectFlickerGuard(): void {
  if (document.getElementById('lockin-gate')) return;

  guardDroppedEarly = false;

  // Black overlay div — covers the page during the verdict round-trip.
  // Using a div (not visibility:hidden on ytd-app) so we can fade it out
  // for a smooth reveal: a fade reads as "loading", an instant vanish reads as "glitch".
  const gate = document.createElement('div');
  gate.id = 'lockin-gate';
  gate.style.cssText =
    'position:fixed;inset:0;background:#0f0f0f;z-index:2147483646;' +
    'opacity:1;transition:opacity 150ms ease-out;';
  (document.body || document.documentElement).appendChild(gate);

  // Adaptive failsafe: drop the gate after `failsafeCeiling` ms even if no verdict arrives.
  flickerGuardTimer = setTimeout(() => {
    guardDroppedEarly = true;
    removeFlickerGuard();
    console.warn(`[Lockin] Flicker guard failsafe triggered (${failsafeCeiling}ms) — SW may be evicted.`);
  }, failsafeCeiling);
}

function removeFlickerGuard(): void {
  if (flickerGuardTimer !== null) {
    clearTimeout(flickerGuardTimer);
    flickerGuardTimer = null;
  }
  const gate = document.getElementById('lockin-gate');
  if (!gate) return;
  // Fade out over 150ms, then remove from DOM.
  gate.style.opacity = '0';
  setTimeout(() => gate.remove(), 160);
}

function injectLateBlockOverlay(): void {
  if (document.getElementById('lockin-late-block-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'lockin-late-block-overlay';
  // A solid black overlay to cover the video if the gate was dropped early
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #0f0f0f; z-index: 2147483647;';
  (document.body || document.documentElement).appendChild(overlay);
}

function activateDOMFilter(whitelist: Whitelist, override?: OverrideState) {
  // Inject CSS for guaranteed absolute hiding of Shorts
  injectGlobalStyles();

  // Check the initial URL on page load
  enforceFilteredModeNavigation();

  // First pass on existing DOM — synchronous.
  // The flicker guard (if injected by init()) is removed here, after the
  // initial filter pass, so the already-filtered content is revealed cleanly.
  filterAllTiles(whitelist, override);
  removeFlickerGuard(); // Gate OFF after initial filter pass

  // ── SPA navigation gate ────────────────────────────────────────────────────
  // YouTube fires yt-navigate-start before it renders the new page's content,
  // and yt-navigate-finish after. We gate on start → filter on finish → reveal.
  // This ensures zero flash of unfiltered content during SPA transitions.
  window.addEventListener('yt-navigate-start', () => {
    // Gate ON — hide content before YouTube renders the new page.
    console.debug('[Lockin] Gate ON (yt-navigate-start)');
    injectFlickerGuard();
  });

  // Hook into YouTube's SPA navigation events
  window.addEventListener('yt-navigate-finish', () => {
    enforceFilteredModeNavigation();

    // Re-fetch storage in case whitelist/override changed during the session
    getStorage().then(({ whitelist: newWhitelist, override: newOverride }) => {
      filterAllTiles(newWhitelist, newOverride);
      // Gate OFF — filter complete, filtered content is now safe to reveal.
      console.debug('[Lockin] Gate OFF (yt-navigate-finish)');
      removeFlickerGuard();
    });
  });

  // Attach observer for newly rendered tiles
  if (document.body) {
    attachObserver(whitelist, override);
    return;
  }

  const docWatcher = new MutationObserver((_, obs) => {
    if (document.body) {
      obs.disconnect();
      attachObserver(whitelist, override);
    }
  });
  docWatcher.observe(document.documentElement || document, { childList: true, subtree: true });
}

// ─── Strict mode — History API interception ───────────────────────────────────

function updateFailsafeCeiling(latency: number) {
  try {
    const raw = sessionStorage.getItem('lockin_latencies');
    const latencies: number[] = raw ? JSON.parse(raw) : [];
    latencies.push(latency);
    if (latencies.length > 20) latencies.shift();
    sessionStorage.setItem('lockin_latencies', JSON.stringify(latencies));

    // Calculate p95
    const sorted = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index] || 400;

    failsafeCeiling = Math.max(400, Math.min(1500, p95 + 100));
  } catch (e) {
    failsafeCeiling = 800; // fallback
  }
}

type DecisionResult = { action: 'allow' | 'block'; reason: string; source?: string; signals?: string[] };

// ─── Verdict session cache ────────────────────────────────────────────────────
// Persists last-known-good verdicts across SW evictions within the browser
// session. If the SW is unavailable after retry, serve the cached verdict
// rather than always failing closed — correct, but jarring for whitelisted pages.

const VERDICT_CACHE_PREFIX = 'lockin_verdict:';

function cacheVerdict(url: string, result: DecisionResult): void {
  try {
    sessionStorage.setItem(VERDICT_CACHE_PREFIX + url, JSON.stringify(result));
  } catch { /* ignore QuotaExceededError */ }
}

function getCachedVerdict(url: string): DecisionResult | null {
  try {
    const raw = sessionStorage.getItem(VERDICT_CACHE_PREFIX + url);
    return raw ? (JSON.parse(raw) as DecisionResult) : null;
  } catch {
    return null;
  }
}

async function checkAndDecideUrl(urlString: string): Promise<DecisionResult> {
  return new Promise((resolve) => {
    const start = Date.now();

    function attempt(isRetry: boolean): void {
      chrome.runtime.sendMessage(
        { type: 'CHECK_AND_DECIDE', url: urlString },
        (response) => {
          // SW may be cold-starting (~300ms). If no response on first attempt, retry once.
          if ((chrome.runtime.lastError || !response) && !isRetry) {
            console.warn('[Lockin] No SW response — retrying in 300ms (SW may be waking up)');
            setTimeout(() => attempt(true), 300);
            return;
          }

          const latency = Date.now() - start;
          updateFailsafeCeiling(latency);

          // On success — cache verdict for SW-eviction resilience.
          // On retry failure — fall back to session cache before failing closed.
          const result: DecisionResult = response
            ? response
            : (getCachedVerdict(urlString) ?? { action: 'block', reason: 'SW unavailable' });
          if (response) cacheVerdict(urlString, result);

          if (result.action === 'allow') {
            removeFlickerGuard();
          } else if (result.action === 'block' && guardDroppedEarly) {
            // Gate already dropped by failsafe — cover screen before redirect to avoid flash.
            injectLateBlockOverlay();
          }
          resolve(result);
        }
      );
    }

    attempt(false);
  });
}

function setupHistoryListener(): void {
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function (state: unknown, unused: string, url?: string | URL | null) {
    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      if (fullUrl.includes('youtube.com')) {
        // Gate ON BEFORE the pushState so content is hidden during the round-trip.
        // If the verdict is 'allow', checkAndDecideUrl removes it.
        // If 'block', we back() and redirect (guard stays).
        console.debug('[Lockin] Gate ON (pushState intercept)');
        injectFlickerGuard();

        checkAndDecideUrl(fullUrl).then((decision) => {
          if (decision.action === 'block') {
            removeFlickerGuard(); // clear before back()
            window.history.back();
            setTimeout(() => {
              const blockUrl = `${BLOCK_PAGE}?from=${encodeURIComponent(fullUrl)}&reason=${encodeURIComponent(decision.reason)}&source=${encodeURIComponent(decision.source || '')}` + (decision.signals ? `&signals=${encodeURIComponent(JSON.stringify(decision.signals))}` : '');
              window.location.href = blockUrl;
            }, 50);
          }
          // allow: checkAndDecideUrl already called removeFlickerGuard()
        }).catch((error) => {
          console.error('[Lockin] Error during checkAndDecideUrl:', error);
          // Fail-open: 800ms failsafe will remove the guard
        });
      }
    }

    return originalPushState.call(this, state, unused, url);
  };

  window.history.replaceState = function (state: unknown, unused: string, url?: string | URL | null) {
    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      if (fullUrl.includes('youtube.com')) {
        // Gate ON before verdict — same rationale as pushState.
        console.debug('[Lockin] Gate ON (replaceState intercept)');
        injectFlickerGuard();

        checkAndDecideUrl(fullUrl).then((decision) => {
          if (decision.action === 'allow') {
            originalReplaceState.call(this, state, unused, url);
            // guard removed inside checkAndDecideUrl
          } else {
            removeFlickerGuard(); // clear before redirect
            const blockUrl = `${BLOCK_PAGE}?from=${encodeURIComponent(fullUrl)}&reason=${encodeURIComponent(decision.reason)}&source=${encodeURIComponent(decision.source || '')}` + (decision.signals ? `&signals=${encodeURIComponent(JSON.stringify(decision.signals))}` : '');
            window.location.href = blockUrl;
          }
        }).catch((error) => {
          console.error('[Lockin] Error during replaceState check:', error);
        });
        return undefined;
      }
    }

    return originalReplaceState.call(this, state, unused, url);
  };

  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    checkAndDecideUrl(url.toString()).then((decision) => {
      if (decision.action === 'block') {
        window.history.back();
        setTimeout(() => {
          const blockUrl = `${BLOCK_PAGE}?from=${encodeURIComponent(url.toString())}&reason=${encodeURIComponent(decision.reason)}&source=${encodeURIComponent(decision.source || '')}` + (decision.signals ? `&signals=${encodeURIComponent(JSON.stringify(decision.signals))}` : '');
          window.location.href = blockUrl;
        }, 50);
      }
    }).catch((error) => {
      console.error('[Lockin] Error during popstate check:', error);
    });
  });

  // ── bfcache restore (back-forward navigation) ──────────────────────────────
  // `pageshow` fires when a page is restored from the browser's back-forward
  // cache. `onBeforeNavigate` does NOT fire for bfcache restores, so without
  // this listener the user could navigate back to a blocked video and see it.
  //
  // Critical ordering:
  //   1. Re-apply the flicker guard SYNCHRONOUSLY (before the SW round-trip)
  //      so the video player is hidden during the latency window.
  //   2. Send the verdict request.
  //   3. Remove the guard only when verdict returns 'allow'.
  //      If verdict returns 'block', redirect to block page (guard stays).
  //
  // The 800ms hard failsafe inside injectFlickerGuard() ensures the page
  // never stays invisible if the SW is evicted or the message is dropped.
  window.addEventListener('pageshow', (event: PageTransitionEvent) => {
    // event.persisted === true means this is a bfcache restore, not initial load.
    // On initial load the normal bootstrap already handles interception.
    if (!event.persisted) return;

    // Step 1: gate immediately — synchronous, before any async work.
    injectFlickerGuard();

    // Step 2 & 3: check verdict, redirect or reveal.
    const url = new URL(window.location.href);
    checkAndDecideUrl(url.toString()).then((decision) => {
      if (decision.action === 'block') {
        // Guard stays up; redirect to block page.
        window.history.back();
        setTimeout(() => {
          const blockUrl = `${BLOCK_PAGE}?from=${encodeURIComponent(url.toString())}&reason=${encodeURIComponent(decision.reason)}&source=${encodeURIComponent(decision.source || '')}` + (decision.signals ? `&signals=${encodeURIComponent(JSON.stringify(decision.signals))}` : '');
          window.location.href = blockUrl;
        }, 50);
      }
      // 'allow' case: checkAndDecideUrl already called removeFlickerGuard()
    }).catch((error) => {
      console.error('[Lockin] Error during bfcache pageshow check:', error);
      // Fail-open on error — guard failsafe will remove it at 800ms.
    });
  });
}

// ─── Startup ──────────────────────────────────────────────────────────────────

/** Track what mode we booted with so we can detect transitions. */
let bootedMode: 'strict' | 'filtered' | null = null;

/**
 * Shows a notice banner on subdomains where filtered-mode DOM selectors
 * don't apply. music.youtube.com uses a `ytmusic-app` root; m.youtube.com
 * uses a redesigned mobile layout — neither matches ytd-* selectors.
 * Prevents silent fail-open in filtered mode.
 */
function showUnsupportedSubdomainBanner(hostname: string): void {
  const banner = document.createElement('div');
  banner.id = 'lockin-unsupported-notice';
  banner.style.cssText =
    'position:fixed;top:0;left:0;right:0;padding:10px 16px;' +
    'background:#f59e0b;color:#1c1917;font:600 13px/1.4 system-ui,sans-serif;' +
    'z-index:2147483647;text-align:center;';
  banner.textContent =
    `Lockin: Filtered mode is not supported on ${hostname}. ` +
    'Switch to Strict mode to enforce blocking here.';
  (document.body || document.documentElement).appendChild(banner);
}

async function init(): Promise<void> {
  const { mode, whitelist, override } = await getStorage();
  bootedMode = mode;

  // Filtered-mode DOM selectors target ytd-* elements and won't match the
  // music (ytmusic-app) or mobile DOM. Show a notice and skip the DOM filter
  // rather than silently failing open. Strict mode still works via background.ts.
  const hostname = window.location.hostname;
  if (mode === 'filtered' &&
      (hostname === 'music.youtube.com' || hostname === 'm.youtube.com')) {
    showUnsupportedSubdomainBanner(hostname);
    return;
  }

  if (mode === 'strict') {
    const overrideIsActive =
      override.disabled ||
      (override.activeUntil !== null && Date.now() < override.activeUntil);

    if (!overrideIsActive) {
      // Inject the flicker guard immediately so the player is hidden while
      // the initial SW verdict round-trip completes. The 800ms failsafe
      // inside injectFlickerGuard() ensures we never leave the page invisible.
      injectFlickerGuard();

      // Check the initial page URL on load. checkAndDecideUrl will call
      // removeFlickerGuard() once the verdict arrives.
      checkAndDecideUrl(window.location.href).then((decision) => {
        if (decision.action === 'block') {
          const blockUrl = `${BLOCK_PAGE}?from=${encodeURIComponent(window.location.href)}&reason=${encodeURIComponent(decision.reason)}&source=${encodeURIComponent(decision.source || '')}` + (decision.signals ? `&signals=${encodeURIComponent(JSON.stringify(decision.signals))}` : '');
          window.location.replace(blockUrl);
        }
        // 'allow' → removeFlickerGuard() already called inside checkAndDecideUrl
      }).catch(() => {
        // Fail-open: guard failsafe will remove it at 800ms
      });

      setupHistoryListener();
    }
  } else {
    // ── Filtered mode ────────────────────────────────────────────────────────
    // Gate ON immediately — hides ytd-app while the first DOM filter pass runs.
    // The gate is removed synchronously inside activateDOMFilter() after the
    // initial filterAllTiles() call completes.
    // The 800ms failsafe inside injectFlickerGuard() ensures the page never
    // stays invisible if filterAllTiles throws or takes too long.
    console.debug('[Lockin] Gate ON (filtered mode init)');
    injectFlickerGuard();
    activateDOMFilter(whitelist, override);
    // Gate OFF is called inside activateDOMFilter after the first filter pass.
  }

  chrome.storage.onChanged.addListener(async () => {
    const { mode: newMode, whitelist: newWhitelist, override: newOverride } = await getStorage();

    // ── Case 1: strict → filtered ─────────────────────────────────────────
    // We can transition smoothly in-place. No reload needed.
    if (bootedMode === 'strict' && newMode === 'filtered') {
      bootedMode = 'filtered';
      // Remove the old history intercept by reloading — YouTube is a SPA so
      // the history hooks from setupHistoryListener() are already in memory.
      // The cleanest way is a reload so the new mode's DOM filter starts fresh.
      window.location.reload();
      return;
    }

    // ── Case 2: strict disabled / temporarily unlocked ────────────────────
    // Override changed while in strict mode → reload so the page gets a clean
    // YouTube experience (no block-page redirects should fire).
    if (bootedMode === 'strict') {
      window.location.reload();
      return;
    }

    // ── Case 3: filtered → strict ─────────────────────────────────────────
    if (bootedMode === 'filtered' && newMode === 'strict') {
      window.location.reload();
      return;
    }

    // ── Case 4: filtered mode — whitelist or override changed ─────────────
    // Re-run the DOM filter in-place for a smooth, instant update.
    if (bootedMode === 'filtered' && newMode === 'filtered') {
      filterAllTiles(newWhitelist, newOverride);
      return;
    }

    // Fallback: reload for any other unexpected transition.
    window.location.reload();
  });
}

init().catch((err) => console.error('[Lockin] Content script init error:', err));

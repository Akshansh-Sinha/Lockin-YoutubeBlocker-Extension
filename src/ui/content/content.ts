import type { Context } from '@/core/engine';
import { extractContext, isAllowed } from '@/core/engine';
import { getStorage } from '@/storage';
import type { Whitelist } from '@/storage/types';

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
    window.location.replace('/');
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

function filterElement(el: Element, whitelist: Whitelist): void {
  // Already hidden — nothing to do
  if ((el as HTMLElement).style.display === 'none') return;

  const tagName = el.tagName.toLowerCase();

  // Unconditionally hide ads and Shorts-exclusive components
  const isAdOrShorts = ['ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-banner-promo-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-reel-shelf-renderer', 'ytd-reel-item-renderer']
    .includes(tagName) || el.querySelector('.ytd-ad-slot-renderer, [class*="ad-slot"]');
  
  if (isAdOrShorts) {
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
    if (title === 'Shorts' || el.querySelector('yt-icon[icon="yt-shorts"], .ytd-shorts-logo')) {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
      return;
    }
  }

  const ctx = buildContext(el);
  if (!ctx) return; // can't resolve → skip, don't hide

  if (!isAllowed(ctx, whitelist, 'filtered')) {
    (el as HTMLElement).style.setProperty('display', 'none', 'important');

    // Fallback: If we just hid a Short inside a shelf, hide the entire shelf container to prevent empty "Shorts" sections.
    if (ctx.isShort) {
      const section = el.closest('ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytd-shelf-renderer, ytd-horizontal-card-list-renderer');
      if (section) {
        (section as HTMLElement).style.setProperty('display', 'none', 'important');
      }
    }
  }
}

function filterAllTiles(whitelist: Whitelist): void {
  document.querySelectorAll(TARGETS_SELECTOR).forEach((el) => {
    // Reset any previous hide so we can re-evaluate with a potentially changed whitelist
    (el as HTMLElement).style.display = '';
    filterElement(el, whitelist);
  });
}

function attachObserver(whitelist: Whitelist) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        // 1. If the added node IS a target tile or contains target tiles
        for (const sel of TARGETS) {
          if (node.matches(sel)) {
            // Execute synchronously to prevent visual flicker
            filterElement(node, whitelist);
          }
          node.querySelectorAll(sel).forEach((el) => {
            filterElement(el, whitelist);
          });
        }

        // 2. If the added node was inserted INSIDE an existing tile
        // (YouTube renders custom elements asynchronously, so the tile is
        // often injected empty, and its anchor tags are added moments later).
        const parentTile = node.closest(TARGETS_SELECTOR);
        if (parentTile) {
          filterElement(parentTile, whitelist);
        }
      }
    }
  });

  observer.observe(document.documentElement || document, { childList: true, subtree: true });
}

function activateDOMFilter(whitelist: Whitelist) {
  // Check the initial URL on page load
  enforceFilteredModeNavigation();

  // First pass on existing DOM
  filterAllTiles(whitelist);

  // Hook into YouTube's SPA navigation events
  window.addEventListener('yt-navigate-finish', () => {
    enforceFilteredModeNavigation();

    // Re-fetch storage just in case it changed during the session
    getStorage().then(({ whitelist: newWhitelist }) => {
      filterAllTiles(newWhitelist);
    });
  });

  // Attach observer for newly rendered tiles
  if (document.body) {
    attachObserver(whitelist);
    return;
  }

  const docWatcher = new MutationObserver((_, obs) => {
    if (document.body) {
      obs.disconnect();
      attachObserver(whitelist);
    }
  });
  docWatcher.observe(document.documentElement || document, { childList: true, subtree: true });
}

// ─── Strict mode — History API interception ───────────────────────────────────

async function checkAndDecideUrl(urlString: string): Promise<{ action: 'allow' | 'block'; reason: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'CHECK_AND_DECIDE', url: urlString },
      (response) => {
        resolve(response || { action: 'allow', reason: 'Default allow' });
      }
    );
  });
}

function setupHistoryListener(): void {
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function (state: unknown, unused: string, url?: string | URL | null) {
    const result = originalPushState.call(this, state, unused, url);

    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      if (fullUrl.includes('youtube.com')) {
        checkAndDecideUrl(fullUrl).then((decision) => {
          if (decision.action === 'block') {
            window.history.back();
            setTimeout(() => {
              const blockUrl = `${BLOCK_PAGE}?from=${encodeURIComponent(fullUrl)}&reason=${encodeURIComponent(decision.reason)}`;
              window.location.href = blockUrl;
            }, 50);
          }
        }).catch((error) => {
          console.error('[Lockin] Error during checkAndDecideUrl:', error);
        });
      }
    }

    return result;
  };

  window.history.replaceState = function (state: unknown, unused: string, url?: string | URL | null) {
    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      if (fullUrl.includes('youtube.com')) {
        checkAndDecideUrl(fullUrl).then((decision) => {
          if (decision.action === 'allow') {
            originalReplaceState.call(this, state, unused, url);
          } else {
            const blockUrl = `${BLOCK_PAGE}?from=${encodeURIComponent(fullUrl)}&reason=${encodeURIComponent(decision.reason)}`;
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
          const blockUrl = `${BLOCK_PAGE}?from=${encodeURIComponent(url.toString())}&reason=${encodeURIComponent(decision.reason)}`;
          window.location.href = blockUrl;
        }, 50);
      }
    }).catch((error) => {
      console.error('[Lockin] Error during popstate check:', error);
    });
  });
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const { mode, whitelist } = await getStorage();

  if (mode === 'strict') {
    setupHistoryListener();
  } else {
    activateDOMFilter(whitelist);
  }

  // Any storage change → reload for a clean re-init in the correct mode
  // with a fresh whitelist.
  chrome.storage.onChanged.addListener(() => {
    window.location.reload();
  });
}

init().catch((err) => console.error('[Lockin] Content script init error:', err));

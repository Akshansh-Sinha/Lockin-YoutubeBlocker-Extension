// Content script: runs on allowed YouTube pages
// Monitors History API and redirects blocked navigations

const BLOCK_PAGE = chrome.runtime.getURL('src/ui/block/index.html');

console.log('[Lockin] Content script starting on URL:', window.location.href);

async function checkAndDecideUrl(urlString: string): Promise<{ action: 'allow' | 'block'; reason: string }> {
  console.log('[Lockin] checkAndDecideUrl called for:', urlString);

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: 'CHECK_AND_DECIDE',
        url: urlString,
      },
      (response) => {
        console.log('[Lockin] checkAndDecideUrl response:', response);
        resolve(response || { action: 'allow', reason: 'Default allow' });
      }
    );
  });
}

function setupHistoryListener() {
  console.log('[Lockin] Setting up History API interception');

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function (state: any, unused: string, url?: string | URL | null) {
    console.log('[Lockin] pushState called with URL:', url);

    // Always call the original pushState first
    const result = originalPushState.call(this, state, unused, url);
    console.log('[Lockin] Original pushState called, history stack updated');

    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      console.log('[Lockin] Full URL after pushState:', fullUrl);

      // Only intercept youtube.com URLs
      if (fullUrl.includes('youtube.com')) {
        console.log('[Lockin] YouTube URL detected, checking if blocked...');

        // Check decision asynchronously AFTER pushState succeeds
        checkAndDecideUrl(fullUrl).then((decision) => {
          console.log('[Lockin] Decision received:', decision);

          if (decision.action === 'block') {
            console.log('[Lockin] URL is blocked, calling history.back()');

            // Go back to undo the pushState
            window.history.back();

            // Then immediately redirect to block page
            setTimeout(() => {
              console.log('[Lockin] Redirecting to block page');
              const encodedUrl = encodeURIComponent(fullUrl);
              const encodedReason = encodeURIComponent(decision.reason);
              const blockUrl = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
              console.log('[Lockin] Block page URL:', blockUrl);
              window.location.href = blockUrl;
            }, 50);
          } else {
            console.log('[Lockin] URL is allowed, navigation continuing');
          }
        }).catch((error) => {
          console.error('[Lockin] Error during checkAndDecideUrl:', error);
        });
      } else {
        console.log('[Lockin] Non-YouTube URL, skipping check:', fullUrl);
      }
    } else {
      console.log('[Lockin] pushState called without URL parameter');
    }

    return result;
  };

  window.history.replaceState = function (state: any, unused: string, url?: string | URL | null) {
    console.log('[Lockin] replaceState called with URL:', url);

    // For replaceState, check first since we're replacing not adding
    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      console.log('[Lockin] Full URL for replaceState:', fullUrl);

      // Only intercept youtube.com URLs
      if (fullUrl.includes('youtube.com')) {
        console.log('[Lockin] YouTube URL detected in replaceState, checking if blocked...');

        // Check if blocked before replacing
        checkAndDecideUrl(fullUrl).then((decision) => {
          console.log('[Lockin] replaceState decision:', decision);

          if (decision.action === 'allow') {
            console.log('[Lockin] URL allowed in replaceState, calling original');
            // Safe to replace
            originalReplaceState.call(this, state, unused, url);
          } else {
            console.log('[Lockin] URL blocked in replaceState, redirecting to block page');
            // Don't replace, redirect to block page
            const encodedUrl = encodeURIComponent(fullUrl);
            const encodedReason = encodeURIComponent(decision.reason);
            const blockUrl = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
            console.log('[Lockin] Block page URL:', blockUrl);
            window.location.href = blockUrl;
          }
        }).catch((error) => {
          console.error('[Lockin] Error during replaceState check:', error);
        });
        return undefined;
      }
    } else {
      console.log('[Lockin] replaceState called without URL parameter');
    }

    return originalReplaceState.call(this, state, unused, url);
  };

  // Also listen for popstate (back/forward button)
  // This fires AFTER the history has changed
  window.addEventListener('popstate', () => {
    console.log('[Lockin] popstate event fired, current URL:', window.location.href);

    const url = new URL(window.location.href);
    checkAndDecideUrl(url.toString()).then((decision) => {
      console.log('[Lockin] popstate decision:', decision);

      if (decision.action === 'block') {
        console.log('[Lockin] Popstate led to blocked URL, calling history.back() and redirecting');
        // User navigated to a blocked URL via back button
        // Go back again and show block page
        window.history.back();
        setTimeout(() => {
          console.log('[Lockin] Redirecting after popstate back');
          const encodedUrl = encodeURIComponent(url.toString());
          const encodedReason = encodeURIComponent(decision.reason);
          const blockUrl = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
          console.log('[Lockin] Block page URL:', blockUrl);
          window.location.href = blockUrl;
        }, 50);
      } else {
        console.log('[Lockin] Popstate led to allowed URL');
      }
    }).catch((error) => {
      console.error('[Lockin] Error during popstate check:', error);
    });
  });

  console.log('[Lockin] History API interception setup complete');
}

setupHistoryListener();
console.log('[Lockin] Content script initialized');

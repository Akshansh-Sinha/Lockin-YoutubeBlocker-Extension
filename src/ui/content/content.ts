// Content script: runs on allowed YouTube pages
// Monitors History API and redirects blocked navigations

const BLOCK_PAGE = chrome.runtime.getURL('src/ui/block/index.html');

console.log('[FocusedTube] Content script starting on URL:', window.location.href);

async function checkAndDecideUrl(urlString: string): Promise<{ action: 'allow' | 'block'; reason: string }> {
  console.log('[FocusedTube] checkAndDecideUrl called for:', urlString);

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: 'CHECK_AND_DECIDE',
        url: urlString,
      },
      (response) => {
        console.log('[FocusedTube] checkAndDecideUrl response:', response);
        resolve(response || { action: 'allow', reason: 'Default allow' });
      }
    );
  });
}

function setupHistoryListener() {
  console.log('[FocusedTube] Setting up History API interception');

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function (state: any, unused: string, url?: string | URL | null) {
    console.log('[FocusedTube] pushState called with URL:', url);

    // Always call the original pushState first
    const result = originalPushState.call(this, state, unused, url);
    console.log('[FocusedTube] Original pushState called, history stack updated');

    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      console.log('[FocusedTube] Full URL after pushState:', fullUrl);

      // Only intercept youtube.com URLs
      if (fullUrl.includes('youtube.com')) {
        console.log('[FocusedTube] YouTube URL detected, checking if blocked...');

        // Check decision asynchronously AFTER pushState succeeds
        checkAndDecideUrl(fullUrl).then((decision) => {
          console.log('[FocusedTube] Decision received:', decision);

          if (decision.action === 'block') {
            console.log('[FocusedTube] URL is blocked, calling history.back()');

            // Go back to undo the pushState
            window.history.back();

            // Then immediately redirect to block page
            setTimeout(() => {
              console.log('[FocusedTube] Redirecting to block page');
              const encodedUrl = encodeURIComponent(fullUrl);
              const encodedReason = encodeURIComponent(decision.reason);
              const blockUrl = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
              console.log('[FocusedTube] Block page URL:', blockUrl);
              window.location.href = blockUrl;
            }, 50);
          } else {
            console.log('[FocusedTube] URL is allowed, navigation continuing');
          }
        }).catch((error) => {
          console.error('[FocusedTube] Error during checkAndDecideUrl:', error);
        });
      } else {
        console.log('[FocusedTube] Non-YouTube URL, skipping check:', fullUrl);
      }
    } else {
      console.log('[FocusedTube] pushState called without URL parameter');
    }

    return result;
  };

  window.history.replaceState = function (state: any, unused: string, url?: string | URL | null) {
    console.log('[FocusedTube] replaceState called with URL:', url);

    // For replaceState, check first since we're replacing not adding
    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      console.log('[FocusedTube] Full URL for replaceState:', fullUrl);

      // Only intercept youtube.com URLs
      if (fullUrl.includes('youtube.com')) {
        console.log('[FocusedTube] YouTube URL detected in replaceState, checking if blocked...');

        // Check if blocked before replacing
        checkAndDecideUrl(fullUrl).then((decision) => {
          console.log('[FocusedTube] replaceState decision:', decision);

          if (decision.action === 'allow') {
            console.log('[FocusedTube] URL allowed in replaceState, calling original');
            // Safe to replace
            originalReplaceState.call(this, state, unused, url);
          } else {
            console.log('[FocusedTube] URL blocked in replaceState, redirecting to block page');
            // Don't replace, redirect to block page
            const encodedUrl = encodeURIComponent(fullUrl);
            const encodedReason = encodeURIComponent(decision.reason);
            const blockUrl = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
            console.log('[FocusedTube] Block page URL:', blockUrl);
            window.location.href = blockUrl;
          }
        }).catch((error) => {
          console.error('[FocusedTube] Error during replaceState check:', error);
        });
        return undefined;
      }
    } else {
      console.log('[FocusedTube] replaceState called without URL parameter');
    }

    return originalReplaceState.call(this, state, unused, url);
  };

  // Also listen for popstate (back/forward button)
  // This fires AFTER the history has changed
  window.addEventListener('popstate', () => {
    console.log('[FocusedTube] popstate event fired, current URL:', window.location.href);

    const url = new URL(window.location.href);
    checkAndDecideUrl(url.toString()).then((decision) => {
      console.log('[FocusedTube] popstate decision:', decision);

      if (decision.action === 'block') {
        console.log('[FocusedTube] Popstate led to blocked URL, calling history.back() and redirecting');
        // User navigated to a blocked URL via back button
        // Go back again and show block page
        window.history.back();
        setTimeout(() => {
          console.log('[FocusedTube] Redirecting after popstate back');
          const encodedUrl = encodeURIComponent(url.toString());
          const encodedReason = encodeURIComponent(decision.reason);
          const blockUrl = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
          console.log('[FocusedTube] Block page URL:', blockUrl);
          window.location.href = blockUrl;
        }, 50);
      } else {
        console.log('[FocusedTube] Popstate led to allowed URL');
      }
    }).catch((error) => {
      console.error('[FocusedTube] Error during popstate check:', error);
    });
  });

  console.log('[FocusedTube] History API interception setup complete');
}

setupHistoryListener();
console.log('[FocusedTube] Content script initialized');

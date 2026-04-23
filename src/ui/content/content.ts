// Content script: runs on allowed YouTube pages
// Monitors History API and redirects blocked navigations

const BLOCK_PAGE = chrome.runtime.getURL('src/ui/block/index.html');

async function checkAndDecideUrl(urlString: string): Promise<{ action: 'allow' | 'block'; reason: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: 'CHECK_AND_DECIDE',
        url: urlString,
      },
      (response) => {
        resolve(response || { action: 'allow', reason: 'Default allow' });
      }
    );
  });
}

function setupHistoryListener() {
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function (state: any, unused: string, url?: string | URL | null) {
    // Always call the original pushState first
    const result = originalPushState.call(this, state, unused, url);

    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      // Only intercept youtube.com URLs
      if (fullUrl.includes('youtube.com')) {
        // Check decision asynchronously AFTER pushState succeeds
        checkAndDecideUrl(fullUrl).then((decision) => {
          if (decision.action === 'block') {
            // Go back to undo the pushState
            window.history.back();
            // Then immediately redirect to block page
            setTimeout(() => {
              const encodedUrl = encodeURIComponent(fullUrl);
              const encodedReason = encodeURIComponent(decision.reason);
              window.location.href = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
            }, 50);
          }
        });
      }
    }

    return result;
  };

  window.history.replaceState = function (state: any, unused: string, url?: string | URL | null) {
    // For replaceState, check first since we're replacing not adding
    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      // Only intercept youtube.com URLs
      if (fullUrl.includes('youtube.com')) {
        // Check if blocked before replacing
        checkAndDecideUrl(fullUrl).then((decision) => {
          if (decision.action === 'allow') {
            // Safe to replace
            originalReplaceState.call(this, state, unused, url);
          } else {
            // Don't replace, redirect to block page
            const encodedUrl = encodeURIComponent(fullUrl);
            const encodedReason = encodeURIComponent(decision.reason);
            window.location.href = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
          }
        });
        return undefined;
      }
    }

    return originalReplaceState.call(this, state, unused, url);
  };

  // Also listen for popstate (back/forward button)
  // This fires AFTER the history has changed
  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    checkAndDecideUrl(url.toString()).then((decision) => {
      if (decision.action === 'block') {
        // User navigated to a blocked URL via back button
        // Go back again and show block page
        window.history.back();
        setTimeout(() => {
          const encodedUrl = encodeURIComponent(url.toString());
          const encodedReason = encodeURIComponent(decision.reason);
          window.location.href = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
        }, 50);
      }
    });
  });
}

setupHistoryListener();
console.log('[FocusedTube] Content script initialized');

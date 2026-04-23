// Content script: runs on allowed YouTube pages
// Intercepts History API navigation and checks if URLs should be blocked

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
    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      // Only intercept youtube.com URLs
      if (fullUrl.includes('youtube.com')) {
        // Check decision first, THEN decide whether to call pushState
        checkAndDecideUrl(fullUrl).then((decision) => {
          if (decision.action === 'allow') {
            // URL is allowed, safe to add to history
            originalPushState.call(this, state, unused, url);
          } else {
            // URL is blocked, DON'T add to history, just redirect
            const encodedUrl = encodeURIComponent(fullUrl);
            const encodedReason = encodeURIComponent(decision.reason);
            window.location.href = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
          }
        });

        // Return immediately without calling originalPushState yet
        // It will be called asynchronously if allowed
        return undefined;
      }
    }

    return originalPushState.call(this, state, unused, url);
  };

  window.history.replaceState = function (state: any, unused: string, url?: string | URL | null) {
    if (url) {
      const urlString = url instanceof URL ? url.href : String(url);
      const fullUrl = new URL(urlString, window.location.href).toString();

      // Only intercept youtube.com URLs
      if (fullUrl.includes('youtube.com')) {
        // Check decision first
        checkAndDecideUrl(fullUrl).then((decision) => {
          if (decision.action === 'allow') {
            // URL is allowed, safe to replace in history
            originalReplaceState.call(this, state, unused, url);
          } else {
            // URL is blocked, redirect without modifying history
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
  // This fires after history has changed, so we need to check the new URL
  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    checkAndDecideUrl(url.toString()).then((decision) => {
      if (decision.action === 'block') {
        // URL was going to be blocked, but user navigated back to it
        // Redirect to block page
        const encodedUrl = encodeURIComponent(url.toString());
        const encodedReason = encodeURIComponent(decision.reason);
        window.location.href = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
      }
    });
  });
}

setupHistoryListener();
console.log('[FocusedTube] Content script initialized');

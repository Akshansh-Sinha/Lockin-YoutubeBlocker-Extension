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
        // Check decision asynchronously, but don't wait for it in this sync function
        checkAndDecideUrl(fullUrl).then((decision) => {
          if (decision.action === 'block') {
            // Redirect to block page
            const encodedUrl = encodeURIComponent(fullUrl);
            const encodedReason = encodeURIComponent(decision.reason);
            window.location.href = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
          }
        });

        // Always call the original pushState to update the history
        // This ensures the history stack is maintained
        const result = originalPushState.call(this, state, unused, url);

        // If we determined it should be blocked, the above .then() will redirect
        return result;
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
        // Check decision asynchronously
        checkAndDecideUrl(fullUrl).then((decision) => {
          if (decision.action === 'block') {
            // Redirect to block page
            const encodedUrl = encodeURIComponent(fullUrl);
            const encodedReason = encodeURIComponent(decision.reason);
            window.location.href = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
          }
        });

        // Always call the original replaceState
        const result = originalReplaceState.call(this, state, unused, url);
        return result;
      }
    }

    return originalReplaceState.call(this, state, unused, url);
  };

  // Also listen for popstate (back/forward button)
  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    checkAndDecideUrl(url.toString()).then((decision) => {
      if (decision.action === 'block') {
        const encodedUrl = encodeURIComponent(url.toString());
        const encodedReason = encodeURIComponent(decision.reason);
        window.location.href = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;
      }
    });
  });
}

setupHistoryListener();
console.log('[FocusedTube] Content script initialized');

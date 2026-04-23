// Content script: runs on allowed YouTube pages
// Phase 1: Detects History API navigation and posts to service worker
// Phase 2: Will add DOM cleanup (hide comments, related, etc.)

function setupHistoryListener() {
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  const notifyServiceWorker = (url: string) => {
    chrome.runtime.sendMessage({
      type: 'CHECK_URL',
      url: url,
    });
  };

  window.history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    const newUrl = new URL(args[2] as string, window.location.href).toString();
    notifyServiceWorker(newUrl);
    return result;
  };

  window.history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    const newUrl = new URL(args[2] as string, window.location.href).toString();
    notifyServiceWorker(newUrl);
    return result;
  };

  // Also listen for popstate (back/forward button)
  window.addEventListener('popstate', () => {
    notifyServiceWorker(window.location.href);
  });
}

setupHistoryListener();
console.log('[FocusedTube] Content script initialized');

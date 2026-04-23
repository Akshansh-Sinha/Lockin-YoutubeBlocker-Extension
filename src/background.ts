import { handleNavigation, makeDecision } from '@/interception/index';

// Listen for hard navigations (onBeforeNavigate)
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) {
    // Only handle top-level frame
    return;
  }

  const url = new URL(details.url);

  // Only intercept youtube.com
  if (!url.hostname.includes('youtube.com')) {
    return;
  }

  handleNavigation(url);
});

// Listen for SPA navigations (onHistoryStateUpdated)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) {
    // Only handle top-level frame
    return;
  }

  const url = new URL(details.url);

  // Only intercept youtube.com
  if (!url.hostname.includes('youtube.com')) {
    return;
  }

  handleNavigation(url);
});

// Message listener for content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK_AND_DECIDE') {
    makeDecision(new URL(message.url))
      .then((verdict) => {
        sendResponse({
          action: verdict.action,
          reason: verdict.reason,
        });
      })
      .catch((error) => {
        console.error('[FocusedTube] Decision error:', error);
        sendResponse({ action: 'block', reason: 'Decision error' });
      });
    return true; // Indicate we'll send a response asynchronously
  }
});

console.log('[FocusedTube] Service worker initialized');

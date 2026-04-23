import { handleNavigation } from '@/interception/index';

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

// Message listener for content script fallback
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK_URL') {
    const url = new URL(message.url);
    handleNavigation(url);
    sendResponse({ ok: true });
  }
});

console.log('[FocusedTube] Service worker initialized');

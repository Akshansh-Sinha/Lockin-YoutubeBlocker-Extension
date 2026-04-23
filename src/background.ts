import { handleNavigation, makeDecision } from '@/interception/index';
import { addVideoToWhitelist, addPlaylistToWhitelist } from '@/storage/index';

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

  if (message.type === 'ADD_VIDEO') {
    addVideoToWhitelist(message.videoId)
      .then(() => {
        console.log('[FocusedTube] Video added to whitelist:', message.videoId);
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('[FocusedTube] Error adding video:', error);
        sendResponse({ success: false, error: String(error) });
      });
    return true;
  }

  if (message.type === 'ADD_PLAYLIST') {
    addPlaylistToWhitelist(message.playlistId)
      .then(() => {
        console.log('[FocusedTube] Playlist added to whitelist:', message.playlistId);
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('[FocusedTube] Error adding playlist:', error);
        sendResponse({ success: false, error: String(error) });
      });
    return true;
  }
});

console.log('[FocusedTube] Service worker initialized');

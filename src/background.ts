import { handleNavigation, makeDecision } from '@/interception/index';
import { addVideoToWhitelist, addPlaylistToWhitelist, getStorage } from '@/storage/index';
import { fetchYouTubeTitle } from '@/youtube/metadata';

// Listen for hard navigations (onBeforeNavigate)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) {
    // Only handle top-level frame
    return;
  }

  const url = new URL(details.url);

  // Only intercept youtube.com
  if (!url.hostname.includes('youtube.com')) {
    return;
  }

  // In filtered mode, navigation is never intercepted — the content script
  // handles DOM-level filtering instead.
  const { mode } = await getStorage();
  if (mode === 'filtered') return;

  handleNavigation(url);
});

// Listen for SPA navigations (onHistoryStateUpdated)
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) {
    // Only handle top-level frame
    return;
  }

  const url = new URL(details.url);

  // Only intercept youtube.com
  if (!url.hostname.includes('youtube.com')) {
    return;
  }

  // In filtered mode, skip interception entirely.
  const { mode } = await getStorage();
  if (mode === 'filtered') return;

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
        console.error('[Lockin] Decision error:', error);
        sendResponse({ action: 'block', reason: 'Decision error' });
      });
    return true; // Indicate we'll send a response asynchronously
  }

  if (message.type === 'ADD_VIDEO') {
    fetchYouTubeTitle('video', message.videoId)
      .then((title) => addVideoToWhitelist(message.videoId, message.name ?? title))
      .then(() => {
        console.log('[Lockin] Video added to whitelist:', message.videoId);
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('[Lockin] Error adding video:', error);
        sendResponse({ success: false, error: String(error) });
      });
    return true;
  }

  if (message.type === 'ADD_PLAYLIST') {
    fetchYouTubeTitle('playlist', message.playlistId)
      .then((title) => addPlaylistToWhitelist(message.playlistId, message.name ?? title))
      .then(() => {
        console.log('[Lockin] Playlist added to whitelist:', message.playlistId);
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('[Lockin] Error adding playlist:', error);
        sendResponse({ success: false, error: String(error) });
      });
    return true;
  }
});

console.log('[Lockin] Service worker initialized');

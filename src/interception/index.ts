import { getVerdict } from '@/decision/engine';
import type { Context } from '@/decision/types';
import { getStorage } from '@/storage/index';

const BLOCK_PAGE = chrome.runtime.getURL('src/ui/block/index.html');

export async function handleNavigation(url: URL): Promise<void> {
  try {
    const storage = await getStorage();
    const now = Date.now();

    const context: Context = {
      url,
      now,
      override: storage.override,
      settings: storage.settings,
      whitelist: storage.whitelist,
    };

    const verdict = await getVerdict(context);

    if (verdict.action === 'block' || verdict.action === 'override_required') {
      // Redirect to block page
      const encodedUrl = encodeURIComponent(url.toString());
      const encodedReason = encodeURIComponent(verdict.reason);
      const blockPageUrl = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;

      // Use tabs.update to navigate in the same tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url: blockPageUrl });
      }
    }
  } catch (error) {
    console.error('[FocusedTube] Navigation handler error:', error);
    // Fail closed: redirect to block page on error
    const encodedUrl = encodeURIComponent(url.toString());
    const blockPageUrl = `${BLOCK_PAGE}?from=${encodedUrl}&reason=Internal%20error`;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.update(tab.id, { url: blockPageUrl });
    }
  }
}

import { extractContext, decide } from '@/core/engine';
import type { Verdict, DecisionInput } from '@/core/engine';
import { getStorage } from '@/storage/index';

const BLOCK_PAGE = chrome.runtime.getURL('src/ui/block/index.html');

/**
 * Async navigation decision entry-point.
 *
 * Responsibilities: read storage (async boundary), build DecisionInput,
 * call the synchronous decide() from core/engine. The decision itself is
 * pure and testable without chrome.storage.
 *
 * TODO(provenance): pass verdict.source to block page via query param.
 */
export async function makeDecision(url: URL): Promise<Verdict> {
  try {
    const storage = await getStorage();
    const input: DecisionInput = {
      ctx: extractContext(url.toString()),
      whitelist: storage.whitelist,
      settings: storage.settings,
      override: storage.override,
      mode: storage.mode,
      now: Date.now(),
    };

    const verdict = decide(input);

    // Log full provenance trail for debuggability (Option A — console only for now).
    console.debug(
      `[Lockin] ${verdict.action.toUpperCase()} (${verdict.source}) — ${verdict.reason}`,
      url.pathname
    );

    return verdict;
  } catch (error) {
    console.error('[Lockin] Decision error:', error);
    return { action: 'block', reason: 'Internal error', source: 'error' };
  }
}

export async function handleNavigation(url: URL): Promise<void> {
  try {
    const verdict = await makeDecision(url);

    if (verdict.action === 'block' || verdict.action === 'override_required') {
      const encodedUrl = encodeURIComponent(url.toString());
      const encodedReason = encodeURIComponent(verdict.reason);
      const blockPageUrl = `${BLOCK_PAGE}?from=${encodedUrl}&reason=${encodedReason}`;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url: blockPageUrl });
      }
    }
  } catch (error) {
    console.error('[Lockin] Navigation handler error:', error);
    // Fail closed
    const encodedUrl = encodeURIComponent(url.toString());
    const blockPageUrl = `${BLOCK_PAGE}?from=${encodedUrl}&reason=Internal%20error`;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.update(tab.id, { url: blockPageUrl });
    }
  }
}

// Re-export so callers don't need a separate import from core/engine
export type { Verdict };

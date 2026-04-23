import type { Rule } from '../types';
import { extractContext, isAllowed } from '@/core/engine';

/**
 * Whitelist rule — delegates URL parsing and allow-checking to core/engine.ts.
 *
 * Strict mode only: channels are NOT consulted here — channel pages are blocked
 * unless individual content (video/playlist) is whitelisted.
 *
 * Allows:
 *  - Whitelisted video IDs (including /shorts/ videoIds)
 *  - Whitelisted playlist IDs (including ?v=X&list=Y combos)
 *
 * Blocks everything else (home, search, unknown routes, channels, non-whitelisted content).
 */
export const whitelistRule: Rule = (ctx) => {
  const urlStr = ctx.url.toString();
  const extracted = extractContext(urlStr);

  // If none of videoId / playlistId could be extracted, this is a non-content
  // page (home, search, channel, feed, etc.) — block.
  if (!extracted.videoId && !extracted.playlistId) {
    return { action: 'block', reason: 'Non-content URL' };
  }

  if (isAllowed(extracted, ctx.whitelist, 'strict')) {
    return { action: 'allow', reason: 'Whitelisted' };
  }

  return { action: 'block', reason: 'Not whitelisted' };
};

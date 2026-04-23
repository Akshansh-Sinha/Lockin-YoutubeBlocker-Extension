import type { Rule } from '../types';
import { classifyRoute } from '@/interception/classifier';

export const whitelistRule: Rule = (ctx) => {
  const route = classifyRoute(ctx.url);

  // Home, search, shorts, etc. — not content URLs, so block
  if (route.type !== 'video' && route.type !== 'playlist') {
    return {
      action: 'block',
      reason: `${route.type}`,
    };
  }

  if (route.type === 'video' && route.id) {
    if (ctx.whitelist.videos.includes(route.id)) {
      return { action: 'allow', reason: 'Video whitelisted' };
    }
    return {
      action: 'block',
      reason: 'Video not whitelisted',
    };
  }

  if (route.type === 'playlist' && route.id) {
    if (ctx.whitelist.playlists.includes(route.id)) {
      return { action: 'allow', reason: 'Playlist whitelisted' };
    }
    return {
      action: 'block',
      reason: 'Playlist not whitelisted',
    };
  }

  // No ID found (malformed URL)
  return {
    action: 'block',
    reason: 'Could not extract ID from URL',
  };
};

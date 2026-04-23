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
    // Check if the video itself is whitelisted
    if (ctx.whitelist.videos.some(item => item.id === route.id)) {
      return { action: 'allow', reason: 'Video whitelisted' };
    }

    // Check if watching from a whitelisted playlist
    const playlistId = ctx.url.searchParams.get('list');
    if (playlistId && ctx.whitelist.playlists.some(item => item.id === playlistId)) {
      return { action: 'allow', reason: 'Playlist whitelisted' };
    }

    return {
      action: 'block',
      reason: 'Video not whitelisted',
    };
  }

  if (route.type === 'playlist' && route.id) {
    if (ctx.whitelist.playlists.some(item => item.id === route.id)) {
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

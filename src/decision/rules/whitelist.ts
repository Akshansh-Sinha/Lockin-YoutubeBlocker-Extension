import type { Rule } from '../types';
import type { WhitelistItem } from '@/storage/types';
import { classifyRoute } from '@/interception/classifier';

type RuntimeWhitelistItem = WhitelistItem | string;

function itemMatchesId(item: RuntimeWhitelistItem, id: string): boolean {
  return typeof item === 'string' ? item === id : item.id === id;
}

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
    const videoId = route.id;

    // Check if the video itself is whitelisted
    if ((ctx.whitelist.videos as RuntimeWhitelistItem[]).some(item => itemMatchesId(item, videoId))) {
      return { action: 'allow', reason: 'Video whitelisted' };
    }

    // Check if watching from a whitelisted playlist
    const playlistId = ctx.url.searchParams.get('list');
    if (playlistId && (ctx.whitelist.playlists as RuntimeWhitelistItem[]).some(item => itemMatchesId(item, playlistId))) {
      return { action: 'allow', reason: 'Playlist whitelisted' };
    }

    return {
      action: 'block',
      reason: 'Video not whitelisted',
    };
  }

  if (route.type === 'playlist' && route.id) {
    const playlistId = route.id;

    if ((ctx.whitelist.playlists as RuntimeWhitelistItem[]).some(item => itemMatchesId(item, playlistId))) {
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

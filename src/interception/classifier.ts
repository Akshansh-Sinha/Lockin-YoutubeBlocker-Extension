import { extractContext } from '@/core/engine';

export interface RouteClassification {
  type: 'video' | 'playlist' | 'home' | 'search' | 'shorts' | 'unknown';
  id: string | null;
}

export function classifyRoute(url: URL): RouteClassification {
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // /watch?v=...
  if (pathname === '/watch' || pathname === '/watch/') {
    const videoId = searchParams.get('v');
    if (videoId) {
      return { type: 'video', id: videoId };
    }
  }

  // /playlist?list=...
  if (pathname === '/playlist' || pathname === '/playlist/') {
    const playlistId = searchParams.get('list');
    if (playlistId) {
      return { type: 'playlist', id: playlistId };
    }
  }

  // /shorts/...
  if (pathname.startsWith('/shorts/')) {
    const shortId = pathname.split('/')[2];
    if (shortId) {
      return { type: 'shorts', id: null };
    }
  }

  // /search, /results
  if (pathname === '/search' || pathname === '/results' || pathname.includes('search') || pathname.includes('results')) {
    return { type: 'search', id: null };
  }

  // /feed/subscriptions, /feed/...
  if (pathname.startsWith('/feed/')) {
    return { type: 'unknown', id: null };
  }

  // Home
  if (pathname === '/' || pathname === '') {
    return { type: 'home', id: null };
  }

  return { type: 'unknown', id: null };
}

/**
 * Extract the YouTube video ID from any YouTube URL string.
 * Delegates to extractContext — single source of truth for URL parsing.
 * Handles youtu.be shortlinks, /watch?v=, and /shorts/ paths.
 */
export function extractVideoIdFromUrl(url: string): string | null {
  return extractContext(url).videoId;
}

/**
 * Extract the YouTube playlist ID from any YouTube URL string.
 * Delegates to extractContext — single source of truth for URL parsing.
 */
export function extractPlaylistIdFromUrl(url: string): string | null {
  return extractContext(url).playlistId;
}

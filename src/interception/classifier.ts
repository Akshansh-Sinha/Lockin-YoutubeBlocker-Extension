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

export function extractVideoIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url, 'https://youtube.com');
    if (urlObj.searchParams.has('v')) {
      return urlObj.searchParams.get('v');
    }
    // youtu.be shortlinks
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('?')[0];
    }
  } catch {
    // invalid URL
  }
  return null;
}

export function extractPlaylistIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url, 'https://youtube.com');
    if (urlObj.searchParams.has('list')) {
      return urlObj.searchParams.get('list');
    }
  } catch {
    // invalid URL
  }
  return null;
}

/**
 * Core engine tests — migrated from decision/engine.test.ts.
 *
 * Tests the pure, synchronous functions in core/engine.ts directly.
 * No chrome.storage mocking required — decide() and isWhitelisted() are pure.
 */
import { describe, it, expect } from 'vitest';
import {
  extractContext,
  extractVideoIdFromUrl,
  decide,
  isWhitelisted,
  isAllowedFiltered,
} from '@/core/engine';
import type { DecisionInput } from '@/core/engine';
import { getDefaults } from '@/storage/migrations';

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const defaults = getDefaults();

const baseInput = (overrides: Partial<DecisionInput> = {}): DecisionInput => ({
  ctx: extractContext('https://youtube.com/watch?v=some_video'),
  whitelist: defaults.whitelist,
  settings: defaults.settings,
  override: defaults.override,
  mode: 'strict' as const,
  now: Date.now(),
  ...overrides,
});

// ─── extractContext — youtube.com ─────────────────────────────────────────────

describe('extractContext — youtube.com', () => {
  it('parses /watch?v= video ID', () => {
    const ctx = extractContext('https://youtube.com/watch?v=abc123');
    expect(ctx.videoId).toBe('abc123');
    expect(ctx.playlistId).toBeNull();
    expect(ctx.isShort).toBe(false);
  });

  it('parses /playlist?list= playlist ID', () => {
    const ctx = extractContext('https://youtube.com/playlist?list=PLabc');
    expect(ctx.playlistId).toBe('PLabc');
    expect(ctx.videoId).toBeNull();
  });

  it('parses video within user playlist (video+list combo)', () => {
    const ctx = extractContext('https://youtube.com/watch?v=vid1&list=PLabc');
    expect(ctx.videoId).toBe('vid1');
    expect(ctx.playlistId).toBe('PLabc');
  });

  it('parses /shorts/ path', () => {
    const ctx = extractContext('https://youtube.com/shorts/abc123');
    expect(ctx.videoId).toBe('abc123');
    expect(ctx.isShort).toBe(true);
    expect(ctx.channelId).toBeNull(); // channel not derivable from /shorts/ URLs
  });

  it('parses channel UCID', () => {
    const ctx = extractContext('https://youtube.com/channel/UCabc123');
    expect(ctx.channelId).toBe('UCabc123');
  });

  it('parses @handle', () => {
    const ctx = extractContext('https://youtube.com/@mkbhd');
    expect(ctx.channelId).toBe('@mkbhd');
  });

  it('returns all-null for home page', () => {
    const ctx = extractContext('https://youtube.com/');
    expect(ctx.videoId).toBeNull();
    expect(ctx.playlistId).toBeNull();
    expect(ctx.channelId).toBeNull();
  });

  it('returns all-null for search results', () => {
    const ctx = extractContext('https://youtube.com/results?search_query=test');
    expect(ctx.videoId).toBeNull();
  });
});

// ─── extractContext — auto-generated playlist stripping ───────────────────────

describe('extractContext — auto-generated playlist stripping', () => {
  it('strips RD* mix playlist IDs', () => {
    const ctx = extractContext('https://youtube.com/watch?v=abc&list=RDabc');
    expect(ctx.videoId).toBe('abc'); // video still whitelistable
    expect(ctx.playlistId).toBeNull(); // mix stripped
  });

  it('strips RDMM (My Mix) prefix', () => {
    expect(extractContext('https://youtube.com/watch?v=abc&list=RDMMabc').playlistId).toBeNull();
  });

  it('strips WL (Watch Later)', () => {
    expect(extractContext('https://youtube.com/watch?v=abc&list=WL').playlistId).toBeNull();
  });

  it('strips LL (Liked Videos)', () => {
    expect(extractContext('https://youtube.com/watch?v=abc&list=LL').playlistId).toBeNull();
  });

  it('strips FL (Favourites — legacy)', () => {
    expect(extractContext('https://youtube.com/watch?v=abc&list=FL').playlistId).toBeNull();
  });

  it('does NOT strip user-curated PLxxx playlists', () => {
    expect(extractContext('https://youtube.com/playlist?list=PLabc123').playlistId).toBe('PLabc123');
  });

  it('does NOT strip OLak* (YouTube Music albums)', () => {
    expect(extractContext('https://youtube.com/playlist?list=OLak5uy').playlistId).toBe('OLak5uy');
  });
});

// ─── extractContext — youtu.be short links ────────────────────────────────────

describe('extractContext — youtu.be short links', () => {
  it('parses bare short link', () => {
    const ctx = extractContext('https://youtu.be/dQw4w9WgXcQ');
    expect(ctx.videoId).toBe('dQw4w9WgXcQ');
    expect(ctx.playlistId).toBeNull();
    expect(ctx.isShort).toBe(false);
    expect(ctx.channelId).toBeNull();
  });

  it('parses short link with user playlist', () => {
    const ctx = extractContext('https://youtu.be/dQw4w9WgXcQ?list=PLabc123');
    expect(ctx.videoId).toBe('dQw4w9WgXcQ');
    expect(ctx.playlistId).toBe('PLabc123');
  });

  it('strips auto-generated mix playlists from short links', () => {
    const ctx = extractContext('https://youtu.be/dQw4w9WgXcQ?list=RDdQw4w9WgXcQ');
    expect(ctx.videoId).toBe('dQw4w9WgXcQ');
    expect(ctx.playlistId).toBeNull();
  });

  it('handles www.youtu.be', () => {
    expect(extractContext('https://www.youtu.be/abc123').videoId).toBe('abc123');
  });

  it('returns null videoId for bare domain with no path', () => {
    expect(extractContext('https://youtu.be/').videoId).toBeNull();
  });

  it('does not treat @handle on youtu.be as channelId (invalid on that host)', () => {
    // youtu.be/@someone is not a valid YouTube URL; channelId should be null
    const ctx = extractContext('https://youtu.be/@someone');
    expect(ctx.channelId).toBeNull();
  });
});

// ─── extractVideoIdFromUrl shim — parser equivalence ────────────────────────

describe('extractVideoIdFromUrl shim — never disagrees with extractContext', () => {
  const urls = [
    'https://youtube.com/watch?v=abc',
    'https://www.youtube.com/watch?v=abc&list=PL1',
    'https://youtu.be/abc123',
    'https://youtu.be/abc123?list=PL1',
    'https://youtube.com/shorts/abc123',
    'https://youtube.com/',
    'https://youtube.com/@mkbhd',
    'not a url',
    '',
  ];

  it.each(urls)('shim(%s) === extractContext(%s).videoId', (url) => {
    expect(extractVideoIdFromUrl(url)).toBe(extractContext(url).videoId);
  });
});

// ─── isWhitelisted ────────────────────────────────────────────────────────────

describe('isWhitelisted', () => {
  const wl = {
    videos: [{ id: 'whitelisted_video', name: 'Test' }],
    playlists: [{ id: 'whitelisted_playlist', name: 'PL' }],
    channels: [{ id: '@trusted_channel', name: 'TC' }],
  };

  it('matches whitelisted video', () => {
    const ctx = extractContext('https://youtube.com/watch?v=whitelisted_video');
    expect(isWhitelisted(ctx, wl)).toBe(true);
  });

  it('matches whitelisted playlist', () => {
    const ctx = extractContext('https://youtube.com/playlist?list=whitelisted_playlist');
    expect(isWhitelisted(ctx, wl)).toBe(true);
  });

  it('matches video watched from whitelisted playlist', () => {
    const ctx = extractContext('https://youtube.com/watch?v=any_video&list=whitelisted_playlist');
    expect(isWhitelisted(ctx, wl)).toBe(true);
  });

  it('matches whitelisted channel', () => {
    const ctx = extractContext('https://youtube.com/@trusted_channel');
    expect(isWhitelisted(ctx, wl)).toBe(true);
  });

  it('does NOT match unknown video', () => {
    const ctx = extractContext('https://youtube.com/watch?v=unknown');
    expect(isWhitelisted(ctx, wl)).toBe(false);
  });

  it('does NOT match video from auto-generated mix (RD* playlist stripped)', () => {
    // The video seed is whitelisted but the mix playlist should not allow other videos
    const wlVideoOnly = { videos: [{ id: 'seed_video' }], playlists: [], channels: [] };
    const ctx = extractContext('https://youtube.com/watch?v=other_video&list=RDseed_video');
    // ctx.playlistId is null (stripped), ctx.videoId is 'other_video' (not whitelisted)
    expect(isWhitelisted(ctx, wlVideoOnly)).toBe(false);
  });
});

// ─── decide() — full decision matrix ─────────────────────────────────────────

describe('decide()', () => {
  it('allows whitelisted video in strict mode', () => {
    const input = baseInput({
      ctx: extractContext('https://youtube.com/watch?v=some_video'),
      whitelist: { videos: [{ id: 'some_video' }], playlists: [], channels: [] },
    });
    expect(decide(input).action).toBe('allow');
    expect(decide(input).source).toBe('whitelist');
  });

  it('blocks non-whitelisted video in strict mode', () => {
    const input = baseInput({ ctx: extractContext('https://youtube.com/watch?v=unknown') });
    const v = decide(input);
    expect(v.action).toBe('block');
    expect(v.source).toBe('default');
  });

  it('allows whitelisted youtu.be video (new parser path)', () => {
    const input = baseInput({
      ctx: extractContext('https://youtu.be/some_video'),
      whitelist: { videos: [{ id: 'some_video' }], playlists: [], channels: [] },
    });
    expect(decide(input).action).toBe('allow');
  });

  it('allows whitelisted playlist', () => {
    const input = baseInput({
      ctx: extractContext('https://youtube.com/playlist?list=whitelisted_playlist'),
      whitelist: { videos: [], playlists: [{ id: 'whitelisted_playlist' }], channels: [] },
    });
    expect(decide(input).action).toBe('allow');
  });

  it('allows video watched from whitelisted playlist', () => {
    const input = baseInput({
      ctx: extractContext('https://youtube.com/watch?v=any_video&list=whitelisted_playlist'),
      whitelist: { videos: [], playlists: [{ id: 'whitelisted_playlist' }], channels: [] },
    });
    const v = decide(input);
    expect(v.action).toBe('allow');
    expect(v.reason).toBe('Whitelisted');
  });

  it('blocks video from non-whitelisted playlist', () => {
    const input = baseInput({
      ctx: extractContext('https://youtube.com/watch?v=any_video&list=other_playlist'),
    });
    expect(decide(input).action).toBe('block');
  });

  it('allows all URLs when blocking is disabled', () => {
    const input = baseInput({
      ctx: extractContext('https://youtube.com/'),
      override: { activeUntil: null, disabled: true, blockingSessionStartedAt: null },
    });
    const v = decide(input);
    expect(v.action).toBe('allow');
    expect(v.source).toBe('disabled');
  });

  it('allows all URLs when override is active', () => {
    const futureTime = Date.now() + 10 * 60 * 1000;
    const input = baseInput({
      ctx: extractContext('https://youtube.com/'),
      override: { activeUntil: futureTime, disabled: false, blockingSessionStartedAt: Date.now() },
      now: Date.now(),
    });
    const v = decide(input);
    expect(v.action).toBe('allow');
    expect(v.source).toBe('override');
  });

  it('blocks when override has expired', () => {
    const pastTime = Date.now() - 1000;
    const input = baseInput({
      ctx: extractContext('https://youtube.com/'),
      override: { activeUntil: pastTime, disabled: false, blockingSessionStartedAt: Date.now() },
      now: Date.now(),
    });
    expect(decide(input).action).toBe('block');
  });

  it('allows all navigation in filtered mode', () => {
    const input = baseInput({
      ctx: extractContext('https://youtube.com/watch?v=unknown'),
      mode: 'filtered',
    });
    const v = decide(input);
    expect(v.action).toBe('allow');
    expect(v.source).toBe('default');
  });

  it('fails closed when whitelist is malformed', () => {
    const input = baseInput({
      ctx: extractContext('https://youtube.com/watch?v=abc'),
      whitelist: null as any,
    });
    const v = decide(input);
    expect(v.action).toBe('block');
    expect(v.source).toBe('error');
  });

  // Regression: the bug that started this fix — seed video in whitelist must NOT
  // grant access to all other songs in its auto-generated mix.
  it('regression: whitelisted seed video does not unlock its RD* mix', () => {
    const wl = { videos: [{ id: 'seed_video' }], playlists: [], channels: [] };
    const otherVideoInMix = extractContext(
      'https://youtube.com/watch?v=other_song&list=RDseed_video'
    );
    // playlistId is null (stripped); videoId is 'other_song' (not whitelisted)
    const input = baseInput({ ctx: otherVideoInMix, whitelist: wl });
    expect(decide(input).action).toBe('block');
  });
});

// ─── isAllowedFiltered — DOM tile visibility ──────────────────────────────────

describe('isAllowedFiltered', () => {
  const wl = { videos: [{ id: 'vid1' }], playlists: [], channels: [] };

  it('always hides Shorts regardless of whitelist', () => {
    const ctx = extractContext('https://youtube.com/shorts/vid1');
    expect(isAllowedFiltered(ctx, wl)).toBe(false);
  });

  it('shows whitelisted video', () => {
    const ctx = extractContext('https://youtube.com/watch?v=vid1');
    expect(isAllowedFiltered(ctx, wl)).toBe(true);
  });

  it('hides non-whitelisted video', () => {
    const ctx = extractContext('https://youtube.com/watch?v=unknown');
    expect(isAllowedFiltered(ctx, wl)).toBe(false);
  });

  it('shows all non-Short content when override is active', () => {
    const ctx = extractContext('https://youtube.com/watch?v=unknown');
    const override = { activeUntil: Date.now() + 60000, disabled: false, blockingSessionStartedAt: null };
    expect(isAllowedFiltered(ctx, wl, override, Date.now())).toBe(true);
  });

  it('shows all non-Short content when blocking is disabled', () => {
    const ctx = extractContext('https://youtube.com/watch?v=unknown');
    const override = { activeUntil: null, disabled: true, blockingSessionStartedAt: null };
    expect(isAllowedFiltered(ctx, wl, override)).toBe(true);
  });

  it('still hides Shorts even when override is active', () => {
    const ctx = extractContext('https://youtube.com/shorts/vid1');
    const override = { activeUntil: Date.now() + 60000, disabled: false, blockingSessionStartedAt: null };
    expect(isAllowedFiltered(ctx, wl, override, Date.now())).toBe(false);
  });
});

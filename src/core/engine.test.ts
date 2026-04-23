import { describe, it, expect } from 'vitest';
import { extractContext, isAllowed, isAllowedStrict, isAllowedFiltered } from './engine';
import type { Whitelist, OverrideState } from '@/storage/types';

// ─── Helper ────────────────────────────────────────────────────────────────

function wl(overrides: Partial<Whitelist> = {}): Whitelist {
  return {
    videos: [],
    playlists: [],
    channels: [],
    ...overrides,
  };
}

function override(activeUntil: number | null): OverrideState {
  return {
    activeUntil,
    disabled: false,
    blockingSessionStartedAt: Date.now(),
  };
}

// ─── extractContext ────────────────────────────────────────────────────────

describe('extractContext', () => {
  it('extracts videoId from ?v= param, isShort: false', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=abc123');
    expect(ctx.videoId).toBe('abc123');
    expect(ctx.isShort).toBe(false);
    expect(ctx.playlistId).toBeNull();
    expect(ctx.channelId).toBeNull();
  });

  it('extracts videoId from /shorts/ path, isShort: true', () => {
    const ctx = extractContext('https://www.youtube.com/shorts/xyz789');
    expect(ctx.videoId).toBe('xyz789');
    expect(ctx.isShort).toBe(true);
    expect(ctx.channelId).toBeNull();
    expect(ctx.playlistId).toBeNull();
  });

  it('extracts both videoId and playlistId from ?v=&list= combo', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=abc&list=PLxyz');
    expect(ctx.videoId).toBe('abc');
    expect(ctx.playlistId).toBe('PLxyz');
    expect(ctx.isShort).toBe(false);
  });

  it('extracts @handle channelId', () => {
    const ctx = extractContext('https://www.youtube.com/@mkbhd');
    expect(ctx.channelId).toBe('@mkbhd');
    expect(ctx.videoId).toBeNull();
    expect(ctx.playlistId).toBeNull();
    expect(ctx.isShort).toBe(false);
  });

  it('extracts UC... UCID from /channel/ path', () => {
    const ctx = extractContext('https://www.youtube.com/channel/UCBcRF18a7Qf58cMAttxNRVQ');
    expect(ctx.channelId).toBe('UCBcRF18a7Qf58cMAttxNRVQ');
    expect(ctx.videoId).toBeNull();
    expect(ctx.isShort).toBe(false);
  });

  it('returns all-null context for invalid URL without throwing', () => {
    const ctx = extractContext('not-a-url');
    expect(ctx.videoId).toBeNull();
    expect(ctx.playlistId).toBeNull();
    expect(ctx.channelId).toBeNull();
    expect(ctx.isShort).toBe(false);
    expect(ctx.url).toBe('not-a-url');
  });

  it('returns null for missing fields on plain youtube.com/', () => {
    const ctx = extractContext('https://www.youtube.com/');
    expect(ctx.videoId).toBeNull();
    expect(ctx.playlistId).toBeNull();
    expect(ctx.channelId).toBeNull();
    expect(ctx.isShort).toBe(false);
  });
});

// ─── isAllowedStrict ────────────────────────────────────────────────────────

describe('isAllowedStrict', () => {
  it('returns true when videoId matches', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=abc');
    expect(isAllowedStrict(ctx, wl({ videos: [{ id: 'abc' }] }))).toBe(true);
  });

  it('returns true when playlistId matches', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=x&list=PLgood');
    expect(isAllowedStrict(ctx, wl({ playlists: [{ id: 'PLgood' }] }))).toBe(true);
  });

  it('returns false when channel is whitelisted but no video/playlist — strict ignores channels', () => {
    const ctx = extractContext('https://www.youtube.com/@mkbhd');
    expect(isAllowedStrict(ctx, wl({ channels: [{ id: '@mkbhd' }] }))).toBe(false);
  });

  it('returns false when nothing matches', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=blocked');
    expect(isAllowedStrict(ctx, wl())).toBe(false);
  });

  it('returns false for home page (no ids)', () => {
    const ctx = extractContext('https://www.youtube.com/');
    expect(isAllowedStrict(ctx, wl({ videos: [{ id: 'abc' }] }))).toBe(false);
  });
});

// ─── isAllowedFiltered ──────────────────────────────────────────────────────

describe('isAllowedFiltered', () => {
  it('returns false for shorts regardless of whitelist — always hidden', () => {
    const ctx = extractContext('https://www.youtube.com/shorts/goodvideo');
    expect(isAllowedFiltered(ctx, wl({ videos: [{ id: 'goodvideo' }] }))).toBe(false);
  });

  it('returns true when videoId matches', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=abc');
    expect(isAllowedFiltered(ctx, wl({ videos: [{ id: 'abc' }] }))).toBe(true);
  });

  it('returns true when playlistId matches', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=x&list=PLgood');
    expect(isAllowedFiltered(ctx, wl({ playlists: [{ id: 'PLgood' }] }))).toBe(true);
  });

  it('returns true when channelId matches', () => {
    const ctx = extractContext('https://www.youtube.com/@mkbhd');
    expect(isAllowedFiltered(ctx, wl({ channels: [{ id: '@mkbhd' }] }))).toBe(true);
  });

  it('returns false when nothing matches', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=blocked');
    expect(isAllowedFiltered(ctx, wl())).toBe(false);
  });

  it('returns false for all-null context (invalid URL)', () => {
    const ctx = extractContext('not-a-url');
    expect(isAllowedFiltered(ctx, wl({ videos: [{ id: 'abc' }], channels: [{ id: '@x' }] }))).toBe(false);
  });

  // ─── Override behavior in filtered mode ─────────────────────────────────────
  it('allows all non-short content when override is active', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=blocked');
    const now = Date.now();
    const activeOverride = override(now + 60000); // expires in 60 seconds
    expect(isAllowedFiltered(ctx, wl(), activeOverride, now)).toBe(true);
  });

  it('blocks content when override has expired', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=blocked');
    const now = Date.now();
    const expiredOverride = override(now - 1000); // expired 1 second ago
    expect(isAllowedFiltered(ctx, wl(), expiredOverride, now)).toBe(false);
  });

  it('allows whitelisted video even without override', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=abc');
    const now = Date.now();
    expect(isAllowedFiltered(ctx, wl({ videos: [{ id: 'abc' }] }), override(null), now)).toBe(true);
  });

  it('blocks shorts even when override is active', () => {
    const ctx = extractContext('https://www.youtube.com/shorts/anything');
    const now = Date.now();
    const activeOverride = override(now + 60000);
    expect(isAllowedFiltered(ctx, wl(), activeOverride, now)).toBe(false);
  });

  it('uses current time when now is not provided', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=blocked');
    const futureOverride = override(Date.now() + 60000); // expires in future
    expect(isAllowedFiltered(ctx, wl(), futureOverride)).toBe(true);
  });

  // ─── Disabled flag behavior in filtered mode ──────────────────────────────
  it('allows all non-short content when blocking is disabled', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=blocked');
    const disabledOverride: OverrideState = {
      activeUntil: null,
      disabled: true,
      blockingSessionStartedAt: Date.now(),
    };
    expect(isAllowedFiltered(ctx, wl(), disabledOverride)).toBe(true);
  });

  it('blocks shorts even when blocking is disabled', () => {
    const ctx = extractContext('https://www.youtube.com/shorts/anything');
    const disabledOverride: OverrideState = {
      activeUntil: null,
      disabled: true,
      blockingSessionStartedAt: Date.now(),
    };
    expect(isAllowedFiltered(ctx, wl(), disabledOverride)).toBe(false);
  });

  it('resumes filtering when blocking is re-enabled', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=blocked');
    const enabledOverride: OverrideState = {
      activeUntil: null,
      disabled: false,
      blockingSessionStartedAt: Date.now(),
    };
    expect(isAllowedFiltered(ctx, wl(), enabledOverride)).toBe(false);
  });
});

// ─── isAllowed (mode dispatcher) ────────────────────────────────────────────

describe('isAllowed mode routing', () => {
  it('strict mode: ignores channel whitelist', () => {
    const ctx = extractContext('https://www.youtube.com/@mkbhd');
    expect(isAllowed(ctx, wl({ channels: [{ id: '@mkbhd' }] }), 'strict')).toBe(false);
  });

  it('filtered mode: consults channel whitelist', () => {
    const ctx = extractContext('https://www.youtube.com/@mkbhd');
    expect(isAllowed(ctx, wl({ channels: [{ id: '@mkbhd' }] }), 'filtered')).toBe(true);
  });

  it('strict mode: allows whitelisted video', () => {
    const ctx = extractContext('https://www.youtube.com/watch?v=abc');
    expect(isAllowed(ctx, wl({ videos: [{ id: 'abc' }] }), 'strict')).toBe(true);
  });

  it('filtered mode: always blocks shorts', () => {
    const ctx = extractContext('https://www.youtube.com/shorts/abc');
    expect(isAllowed(ctx, wl({ videos: [{ id: 'abc' }] }), 'filtered')).toBe(false);
  });
});

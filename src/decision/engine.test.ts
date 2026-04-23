import { describe, it, expect } from 'vitest';
import { getVerdict } from './engine';
import type { Context } from './types';
import { getDefaults } from '@/storage/migrations';

describe('decision engine', () => {
  const defaults = getDefaults();

  it('should allow whitelisted video', async () => {
    const context: Context = {
      url: new URL('https://youtube.com/watch?v=whitelisted_video'),
      now: Date.now(),
      override: defaults.override,
      settings: defaults.settings,
      whitelist: {
        videos: ['whitelisted_video'],
        playlists: [],
      },
    };

    const verdict = await getVerdict(context);
    expect(verdict.action).toBe('allow');
  });

  it('should block non-whitelisted video', async () => {
    const context: Context = {
      url: new URL('https://youtube.com/watch?v=unknown_video'),
      now: Date.now(),
      override: defaults.override,
      settings: defaults.settings,
      whitelist: {
        videos: [],
        playlists: [],
      },
    };

    const verdict = await getVerdict(context);
    expect(verdict.action).toBe('block');
  });

  it('should block home page', async () => {
    const context: Context = {
      url: new URL('https://youtube.com/'),
      now: Date.now(),
      override: defaults.override,
      settings: defaults.settings,
      whitelist: defaults.whitelist,
    };

    const verdict = await getVerdict(context);
    expect(verdict.action).toBe('block');
  });

  it('should block search results', async () => {
    const context: Context = {
      url: new URL('https://youtube.com/results?search_query=test'),
      now: Date.now(),
      override: defaults.override,
      settings: defaults.settings,
      whitelist: defaults.whitelist,
    };

    const verdict = await getVerdict(context);
    expect(verdict.action).toBe('block');
  });

  it('should allow all URLs when override is active', async () => {
    const futureTime = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    const context: Context = {
      url: new URL('https://youtube.com/'),
      now: Date.now(),
      override: { activeUntil: futureTime },
      settings: defaults.settings,
      whitelist: defaults.whitelist,
    };

    const verdict = await getVerdict(context);
    expect(verdict.action).toBe('allow');
    expect(verdict.reason).toBe('Override active');
  });

  it('should not allow expired override', async () => {
    const pastTime = Date.now() - 1000; // 1 second ago

    const context: Context = {
      url: new URL('https://youtube.com/'),
      now: Date.now(),
      override: { activeUntil: pastTime },
      settings: defaults.settings,
      whitelist: defaults.whitelist,
    };

    const verdict = await getVerdict(context);
    expect(verdict.action).toBe('block');
  });

  it('should allow whitelisted playlist', async () => {
    const context: Context = {
      url: new URL('https://youtube.com/playlist?list=whitelisted_playlist'),
      now: Date.now(),
      override: defaults.override,
      settings: defaults.settings,
      whitelist: {
        videos: [],
        playlists: ['whitelisted_playlist'],
      },
    };

    const verdict = await getVerdict(context);
    expect(verdict.action).toBe('allow');
  });
});

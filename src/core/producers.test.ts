/**
 * src/core/producers.test.ts
 *
 * Per-producer isolation tests. Each producer is a pure function and should
 * be testable with minimal setup — no chrome.storage, no decide() pipeline.
 * If a producer requires >50 lines of setup it's doing too much (split it).
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  OverrideProducer,
  ModeProducer,
  WhitelistProducer,
  DefaultResolver,
  extractContext,
} from './engine';
import { KeywordProducer } from '@/decision/producers/keyword';
import { MetadataProducer } from '@/decision/producers/metadata';
import type { DecisionInput } from './engine';
import { getDefaults } from '@/storage/migrations';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const defaults = getDefaults();

function makeInput(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    ctx: extractContext('https://www.youtube.com/watch?v=abc'),
    whitelist: defaults.whitelist,
    settings: defaults.settings,
    override: defaults.override,
    mode: 'strict',
    now: Date.now(),
    ...overrides,
  };
}

// ─── OverrideProducer ─────────────────────────────────────────────────────────

describe('OverrideProducer', () => {
  it('emits override:disabled when blocking is disabled', () => {
    const input = makeInput({
      override: { activeUntil: null, disabled: true, blockingSessionStartedAt: null },
    });
    expect(OverrideProducer.produce(input)).toContain('override:disabled');
  });

  it('emits override:active when activeUntil is in the future', () => {
    const input = makeInput({
      override: { activeUntil: Date.now() + 60_000, disabled: false, blockingSessionStartedAt: Date.now() },
      now: Date.now(),
    });
    expect(OverrideProducer.produce(input)).toContain('override:active');
  });

  it('emits nothing when activeUntil has expired', () => {
    const input = makeInput({
      override: { activeUntil: Date.now() - 1_000, disabled: false, blockingSessionStartedAt: Date.now() },
      now: Date.now(),
    });
    expect(OverrideProducer.produce(input)).toHaveLength(0);
  });

  it('emits nothing when override is completely inactive', () => {
    const input = makeInput({
      override: { activeUntil: null, disabled: false, blockingSessionStartedAt: null },
    });
    expect(OverrideProducer.produce(input)).toHaveLength(0);
  });

  it('prefers override:disabled over override:active when both could apply', () => {
    // disabled=true wins regardless of activeUntil
    const input = makeInput({
      override: { activeUntil: Date.now() + 60_000, disabled: true, blockingSessionStartedAt: null },
      now: Date.now(),
    });
    const signals = OverrideProducer.produce(input) as string[];
    expect(signals).toContain('override:disabled');
    expect(signals).not.toContain('override:active');
  });
});

// ─── ModeProducer ─────────────────────────────────────────────────────────────

describe('ModeProducer', () => {
  it('emits mode:strict in strict mode', () => {
    expect(ModeProducer.produce(makeInput({ mode: 'strict' }))).toContain('mode:strict');
  });

  it('emits mode:filtered in filtered mode', () => {
    expect(ModeProducer.produce(makeInput({ mode: 'filtered' }))).toContain('mode:filtered');
  });

  it('always emits exactly one signal', () => {
    expect(ModeProducer.produce(makeInput({ mode: 'strict' }))).toHaveLength(1);
    expect(ModeProducer.produce(makeInput({ mode: 'filtered' }))).toHaveLength(1);
  });
});

// ─── WhitelistProducer ────────────────────────────────────────────────────────

describe('WhitelistProducer', () => {
  it('emits whitelist:match for a whitelisted video', () => {
    const input = makeInput({
      ctx: extractContext('https://www.youtube.com/watch?v=vid1'),
      whitelist: { videos: [{ id: 'vid1' }], playlists: [], channels: [] },
    });
    expect(WhitelistProducer.produce(input)).toContain('whitelist:match');
  });

  it('emits whitelist:match for a whitelisted playlist', () => {
    const input = makeInput({
      ctx: extractContext('https://www.youtube.com/playlist?list=PLgood'),
      whitelist: { videos: [], playlists: [{ id: 'PLgood' }], channels: [] },
    });
    expect(WhitelistProducer.produce(input)).toContain('whitelist:match');
  });

  it('emits whitelist:match for a whitelisted channel', () => {
    const input = makeInput({
      ctx: extractContext('https://www.youtube.com/@mkbhd'),
      whitelist: { videos: [], playlists: [], channels: [{ id: '@mkbhd' }] },
    });
    expect(WhitelistProducer.produce(input)).toContain('whitelist:match');
  });

  it('emits nothing when nothing matches', () => {
    const input = makeInput({
      ctx: extractContext('https://www.youtube.com/watch?v=unknown'),
      whitelist: { videos: [{ id: 'other' }], playlists: [], channels: [] },
    });
    expect(WhitelistProducer.produce(input)).toHaveLength(0);
  });

  it('does NOT emit whitelist:match for an auto-generated mix playlist (RD*)', () => {
    // RD* playlists are stripped in extractContext — playlistId will be null
    const input = makeInput({
      ctx: extractContext('https://www.youtube.com/watch?v=seed&list=RDseed'),
      whitelist: { videos: [], playlists: [{ id: 'RDseed' }], channels: [] },
    });
    // playlistId is null after stripping, so no match even if RD* is in whitelist
    expect(WhitelistProducer.produce(input)).toHaveLength(0);
  });
});

// ─── KeywordProducer ──────────────────────────────────────────────────────────

describe('KeywordProducer', () => {
  const originalProduce = MetadataProducer.produce;

  afterEach(() => {
    MetadataProducer.produce = originalProduce;
  });

  it('emits nothing when no keywords are configured', async () => {
    const input = makeInput({ settings: { ...defaults.settings, allowKeywords: [], blockKeywords: [] } });
    expect(await KeywordProducer.produce(input)).toHaveLength(0);
  });

  it('emits keyword:allow when title matches allow keyword', async () => {
    MetadataProducer.produce = async () => ['metadata:title:hello world'];
    const input = makeInput({ settings: { ...defaults.settings, allowKeywords: ['world'], blockKeywords: [] } });
    expect(await KeywordProducer.produce(input)).toContain('keyword:allow:world');
  });

  it('emits keyword:block when author matches block keyword', async () => {
    MetadataProducer.produce = async () => ['metadata:author:badguy'];
    const input = makeInput({ settings: { ...defaults.settings, allowKeywords: [], blockKeywords: ['badguy'] } });
    expect(await KeywordProducer.produce(input)).toContain('keyword:block:badguy');
  });

  it('emits multiple signals if multiple keywords match', async () => {
    MetadataProducer.produce = async () => ['metadata:title:apple orange'];
    const input = makeInput({ settings: { ...defaults.settings, allowKeywords: ['apple'], blockKeywords: ['orange'] } });
    const signals = await KeywordProducer.produce(input);
    expect(signals).toContain('keyword:allow:apple');
    expect(signals).toContain('keyword:block:orange');
  });
});

// ─── DefaultResolver ──────────────────────────────────────────────────────────

describe('DefaultResolver', () => {
  const input = makeInput(); // resolver doesn't use input directly in current impl

  it('returns disabled verdict when override:disabled is present', () => {
    const v = DefaultResolver.resolve(['override:disabled', 'mode:strict'], input);
    expect(v.action).toBe('allow');
    expect(v.source).toBe('disabled');
    expect(v.reason).toBe('Blocking disabled');
  });

  it('returns override verdict when override:active is present', () => {
    const v = DefaultResolver.resolve(['override:active', 'mode:strict'], input);
    expect(v.action).toBe('allow');
    expect(v.source).toBe('override');
  });

  it('override:disabled takes precedence over override:active', () => {
    const v = DefaultResolver.resolve(['override:disabled', 'override:active', 'mode:strict'], input);
    expect(v.source).toBe('disabled');
  });

  it('allows whitelisted video in strict mode', () => {
    const v = DefaultResolver.resolve(['mode:strict', 'whitelist:match'], input);
    expect(v.action).toBe('allow');
    expect(v.source).toBe('whitelist');
  });

  it('blocks non-whitelisted video in strict mode (default deny)', () => {
    const v = DefaultResolver.resolve(['mode:strict'], input);
    expect(v.action).toBe('block');
    expect(v.source).toBe('default');
    expect(v.reason).toBe('Default deny');
  });

  it('allows all navigation in filtered mode', () => {
    const v = DefaultResolver.resolve(['mode:filtered'], input);
    expect(v.action).toBe('allow');
    expect(v.source).toBe('default');
    expect(v.reason).toBe('Filtered mode');
  });

  it('whitelist:match alone (without mode:strict) does NOT allow in strict mode', () => {
    // Resolver requires BOTH mode:strict AND whitelist:match to allow
    const v = DefaultResolver.resolve(['whitelist:match'], input);
    expect(v.action).toBe('block');
  });

  it('signals array is passed through to the verdict', () => {
    const signals = ['mode:strict', 'whitelist:match'];
    const v = DefaultResolver.resolve(signals, input);
    expect(v.signals).toEqual(signals);
  });

  it('allows video when keyword:allow is present (overriding strict block)', () => {
    const v = DefaultResolver.resolve(['mode:strict', 'keyword:allow:apple'], input);
    expect(v.action).toBe('allow');
    expect(v.reason).toBe('Contains allowed keyword: "apple"');
  });

  it('blocks video when keyword:block is present (overriding filtered allow)', () => {
    const v = DefaultResolver.resolve(['mode:filtered', 'keyword:block:orange'], input);
    expect(v.action).toBe('block');
    expect(v.reason).toBe('Contains blocked keyword: "orange"');
  });

  it('blocks video when keyword:block is present (overriding keyword:allow)', () => {
    const v = DefaultResolver.resolve(['mode:strict', 'keyword:block:orange', 'keyword:allow:apple'], input);
    expect(v.action).toBe('block');
  });

  it('allows video when whitelist:match is present, even if keyword:block is present', () => {
    const v = DefaultResolver.resolve(['mode:strict', 'whitelist:match', 'keyword:block:orange'], input);
    expect(v.action).toBe('allow');
    expect(v.source).toBe('whitelist');
  });
});

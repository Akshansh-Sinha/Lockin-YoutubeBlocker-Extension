/**
 * src/core/engine.ts
 *
 * Single source of truth for URL context extraction and allow/block decisions.
 * All callers (whitelist rule, background, content script) MUST use these
 * functions — never re-implement them.
 */

import type { Whitelist, WhitelistItem, Mode } from '@/storage/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Context {
  /** YouTube video ID from ?v= param, or from /shorts/ID path. Null if not found. */
  videoId: string | null;
  /** YouTube playlist ID from ?list= param. Null if not found. */
  playlistId: string | null;
  /**
   * YouTube channel identifier — either a "UC…" UCID or a "@handle" string
   * (stored as-is, including the "@" prefix). Null if not found.
   */
  channelId: string | null;
  /** True when the URL is a YouTube Shorts URL (/shorts/…). */
  isShort: boolean;
  /** Original URL string, preserved for logging / downstream use. */
  url: string;
}

// ─── extractContext ────────────────────────────────────────────────────────────

const CHANNEL_UCID_RE = /\/channel\/(UC[a-zA-Z0-9_-]+)/;
const CHANNEL_HANDLE_RE = /\/@([a-zA-Z0-9_.-]+)/;

/**
 * Extract a structured Context from a YouTube URL string.
 * Returns null for any field that cannot be determined from the URL alone —
 * never touches the DOM or makes network requests.
 */
export function extractContext(url: string): Context {
  let urlObj: URL;

  try {
    urlObj = new URL(url);
  } catch {
    return { videoId: null, playlistId: null, channelId: null, isShort: false, url };
  }

  const pathname = urlObj.pathname;
  const params = urlObj.searchParams;
  const isShort = pathname.startsWith('/shorts/');

  // ── Video ID ──────────────────────────────────────────────────────────────
  let videoId: string | null = null;

  if (isShort) {
    // /shorts/VIDEO_ID — extract from path; no channelId derivable from URL
    const shortId = pathname.split('/')[2];
    if (shortId) videoId = shortId;
  } else {
    // Standard ?v= param
    videoId = params.get('v');
  }

  // ── Playlist ID ───────────────────────────────────────────────────────────
  // All playlist IDs (including WL, LL) treated identically — no special casing.
  const playlistId = params.get('list');

  // ── Channel ID ────────────────────────────────────────────────────────────
  // Do NOT read from DOM or innerText — URL only.
  // Skip channel extraction for /shorts/ URLs (no reliable channel in URL).
  let channelId: string | null = null;

  if (!isShort) {
    const ucidMatch = CHANNEL_UCID_RE.exec(pathname);
    if (ucidMatch) {
      channelId = ucidMatch[1]; // raw UCID, e.g. "UCxxxxxx"
    } else {
      const handleMatch = CHANNEL_HANDLE_RE.exec(pathname);
      if (handleMatch) {
        channelId = `@${handleMatch[1]}`; // stored with "@" prefix, e.g. "@mkbhd"
      }
    }
  }

  return { videoId, playlistId, channelId, isShort, url };
}

// ─── Allow checks ─────────────────────────────────────────────────────────────

function matchesWhitelistItem(items: WhitelistItem[], id: string): boolean {
  return items.some((item) => item.id === id);
}

/**
 * Strict mode: only videos and playlists are consulted.
 * Channels are NEVER checked in strict mode — channel pages are blocked unless
 * individual content (video/playlist) is whitelisted.
 */
export function isAllowedStrict(ctx: Context, whitelist: Whitelist): boolean {
  if (ctx.videoId && matchesWhitelistItem(whitelist.videos, ctx.videoId)) {
    return true;
  }

  if (ctx.playlistId && matchesWhitelistItem(whitelist.playlists, ctx.playlistId)) {
    return true;
  }

  return false;
}

/**
 * Filtered mode: navigation is not intercepted; this function determines
 * whether a DOM tile should remain visible.
 *
 * Rules (strict order):
 *  0. Shorts are ALWAYS hidden — no whitelist entry overrides this.
 *  1. videoId   in whitelist.videos   → visible
 *  2. playlistId in whitelist.playlists → visible
 *  3. channelId  in whitelist.channels → visible (includes all their content)
 *  4. → hidden
 */
export function isAllowedFiltered(ctx: Context, whitelist: Whitelist): boolean {
  if (ctx.isShort) return false;

  if (ctx.videoId && matchesWhitelistItem(whitelist.videos, ctx.videoId)) {
    return true;
  }

  if (ctx.playlistId && matchesWhitelistItem(whitelist.playlists, ctx.playlistId)) {
    return true;
  }

  if (ctx.channelId && matchesWhitelistItem(whitelist.channels, ctx.channelId)) {
    return true;
  }

  return false;
}

/**
 * Unified entry point — routes to the correct mode-specific function.
 */
export function isAllowed(ctx: Context, whitelist: Whitelist, mode: Mode): boolean {
  if (mode === 'strict') return isAllowedStrict(ctx, whitelist);
  return isAllowedFiltered(ctx, whitelist);
}

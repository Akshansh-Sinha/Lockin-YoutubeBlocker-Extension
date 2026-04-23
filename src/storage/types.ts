export interface WhitelistItem {
  id: string;
  name?: string;
}

export interface Whitelist {
  videos: WhitelistItem[];
  playlists: WhitelistItem[];
  /** Mix of "UC…" UCIDs and "@handle" strings — both stored as-is. */
  channels: WhitelistItem[];
}

/** The active blocking mode. */
export type Mode = 'strict' | 'filtered';

export interface Settings {
  stripRelated: boolean;
  stripComments: boolean;
  stripShorts: boolean;
  allowKeywords: string[];
  blockKeywords: string[];
}

export interface SecurityData {
  passwordHash: string | null;
  salt: string | null;
}

export interface OverrideState {
  activeUntil: number | null;
  disabled: boolean;
  blockingSessionStartedAt: number | null;
}

export interface RateLimitData {
  attemptCount: number;
  lockedUntil: number | null;
}

export interface StorageSchema {
  schemaVersion: number;
  /**
   * 'strict'   — navigation is intercepted; non-whitelisted URLs redirect to block page.
   * 'filtered' — navigation is never intercepted; content script hides non-whitelisted tiles.
   */
  mode: Mode;
  whitelist: Whitelist;
  settings: Settings;
  security: SecurityData;
  override: OverrideState;
  rateLimit: RateLimitData;
}

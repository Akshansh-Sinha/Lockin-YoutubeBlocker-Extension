export interface Whitelist {
  videos: string[];
  playlists: string[];
}

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
}

export interface RateLimitData {
  attemptCount: number;
  lockedUntil: number | null;
}

export interface StorageSchema {
  schemaVersion: number;
  whitelist: Whitelist;
  settings: Settings;
  security: SecurityData;
  override: OverrideState;
  rateLimit: RateLimitData;
}

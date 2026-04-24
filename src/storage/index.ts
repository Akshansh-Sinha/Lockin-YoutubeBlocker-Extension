import type { StorageSchema, Whitelist, WhitelistItem, Mode, OverrideState } from './types';
import { getDefaults } from './migrations';

// ─── Storage backend — sync with local fallback ────────────────────────────────

/**
 * Write to chrome.storage.sync. Falls back to chrome.storage.local if the
 * sync quota is exceeded (QUOTA_BYTES_PER_ITEM or total QUOTA_BYTES).
 */
async function storageSet(data: object): Promise<void> {
  try {
    await chrome.storage.sync.set(data);
  } catch {
    // Quota exceeded — persist locally so data is never lost.
    await chrome.storage.local.set(data);
  }
}

/**
 * Read from chrome.storage.sync. Falls back to chrome.storage.local on error
 * (e.g. if data was previously written locally due to a quota fallback).
 */
async function storageGet(keys: null): Promise<Record<string, unknown>> {
  try {
    return await chrome.storage.sync.get(keys) as Record<string, unknown>;
  } catch {
    return await chrome.storage.local.get(keys) as Record<string, unknown>;
  }
}

// ─── Whitelist normalization ───────────────────────────────────────────────────

type LegacyWhitelistItem = string | WhitelistItem;
type LegacyWhitelist = {
  videos?: LegacyWhitelistItem[];
  playlists?: LegacyWhitelistItem[];
  channels?: LegacyWhitelistItem[];
};

function normalizeWhitelistItem(item: LegacyWhitelistItem): WhitelistItem | null {
  if (typeof item === 'string') {
    return item ? { id: item } : null;
  }

  if (item && typeof item.id === 'string' && item.id) {
    return {
      id: item.id,
      name: item.name,
    };
  }

  return null;
}

function normalizeWhitelist(whitelist: LegacyWhitelist | undefined, fallback: Whitelist): Whitelist {
  const videos = whitelist?.videos ?? fallback.videos;
  const playlists = whitelist?.playlists ?? fallback.playlists;
  const channels = whitelist?.channels ?? fallback.channels;

  return {
    videos: videos.map(normalizeWhitelistItem).filter((item): item is WhitelistItem => item !== null),
    playlists: playlists.map(normalizeWhitelistItem).filter((item): item is WhitelistItem => item !== null),
    channels: channels.map(normalizeWhitelistItem).filter((item): item is WhitelistItem => item !== null),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getStorage(): Promise<StorageSchema> {
  const data = await storageGet(null);
  
  // Read override explicitly from local storage
  const localData = await chrome.storage.local.get(['override']);
  const localOverride = localData.override as Partial<OverrideState> | undefined;

  const stored = data as Partial<Omit<StorageSchema, 'whitelist' | 'override'>> & { whitelist?: LegacyWhitelist };

  const schema = getDefaults();
  return {
    schemaVersion: stored.schemaVersion ?? schema.schemaVersion,
    mode: stored.mode ?? schema.mode,
    whitelist: normalizeWhitelist(stored.whitelist, schema.whitelist),
    settings: stored.settings ?? schema.settings,
    security: stored.security ?? schema.security,
    override: {
      ...schema.override,
      ...localOverride, // use local override
    },
    rateLimit: stored.rateLimit ?? schema.rateLimit,
  };
}

export async function setStorage(schema: StorageSchema): Promise<void> {
  // Extract override
  const { override, ...rest } = schema;
  
  // Save everything else to sync (with fallback)
  await storageSet(rest);
  
  // Save override exclusively to local
  await chrome.storage.local.set({ override });
}

export async function addVideoToWhitelist(videoId: string, name?: string): Promise<void> {
  const schema = await getStorage();
  const existing = schema.whitelist.videos.find(item => item.id === videoId);

  if (existing) {
    if (name && !existing.name) {
      existing.name = name;
      await setStorage(schema);
    }
  } else {
    schema.whitelist.videos.push({ id: videoId, name });
    await setStorage(schema);
  }
}

export async function removeVideoFromWhitelist(videoId: string): Promise<void> {
  const schema = await getStorage();
  schema.whitelist.videos = schema.whitelist.videos.filter(item => item.id !== videoId);
  await setStorage(schema);
}

export async function addPlaylistToWhitelist(playlistId: string, name?: string): Promise<void> {
  const schema = await getStorage();
  const existing = schema.whitelist.playlists.find(item => item.id === playlistId);

  if (existing) {
    if (name && !existing.name) {
      existing.name = name;
      await setStorage(schema);
    }
  } else {
    schema.whitelist.playlists.push({ id: playlistId, name });
    await setStorage(schema);
  }
}

export async function setVideoWhitelistName(videoId: string, name: string): Promise<void> {
  const schema = await getStorage();
  const item = schema.whitelist.videos.find(entry => entry.id === videoId);
  if (item && !item.name) {
    item.name = name;
    await setStorage(schema);
  }
}

export async function setPlaylistWhitelistName(playlistId: string, name: string): Promise<void> {
  const schema = await getStorage();
  const item = schema.whitelist.playlists.find(entry => entry.id === playlistId);
  if (item && !item.name) {
    item.name = name;
    await setStorage(schema);
  }
}

export async function removePlaylistFromWhitelist(playlistId: string): Promise<void> {
  const schema = await getStorage();
  schema.whitelist.playlists = schema.whitelist.playlists.filter(item => item.id !== playlistId);
  await setStorage(schema);
}

export async function setPasswordHash(hash: string, salt: string): Promise<void> {
  const schema = await getStorage();
  schema.security.passwordHash = hash;
  schema.security.salt = salt;
  await setStorage(schema);
}

export async function setOverrideExpiry(ms: number | null): Promise<void> {
  const schema = await getStorage();
  schema.override.activeUntil = ms;
  if (ms !== null) {
    schema.override.disabled = false;
    schema.override.blockingSessionStartedAt ??= Date.now();
  }
  await setStorage(schema);
}

export async function setBlockingDisabled(disabled: boolean): Promise<void> {
  const schema = await getStorage();
  schema.override.disabled = disabled;
  schema.override.activeUntil = null;
  schema.override.blockingSessionStartedAt = disabled ? null : Date.now();
  await setStorage(schema);
}

export async function ensureBlockingSessionStarted(): Promise<number> {
  const schema = await getStorage();
  if (schema.override.blockingSessionStartedAt === null) {
    schema.override.blockingSessionStartedAt = Date.now();
    await setStorage(schema);
  }
  return schema.override.blockingSessionStartedAt;
}

export async function setRateLimit(attemptCount: number, lockedUntil: number | null): Promise<void> {
  const schema = await getStorage();
  schema.rateLimit.attemptCount = attemptCount;
  schema.rateLimit.lockedUntil = lockedUntil;
  await setStorage(schema);
}

export async function setMode(mode: Mode): Promise<void> {
  const schema = await getStorage();
  schema.mode = mode;
  await setStorage(schema);
}

export async function addChannelToWhitelist(item: WhitelistItem): Promise<void> {
  const schema = await getStorage();
  const existing = schema.whitelist.channels.find((c) => c.id === item.id);

  if (existing) {
    if (item.name && !existing.name) {
      existing.name = item.name;
      await setStorage(schema);
    }
  } else {
    schema.whitelist.channels.push({ id: item.id, name: item.name });
    await setStorage(schema);
  }
}

export async function removeChannelFromWhitelist(channelId: string): Promise<void> {
  const schema = await getStorage();
  schema.whitelist.channels = schema.whitelist.channels.filter((item) => item.id !== channelId);
  await setStorage(schema);
}

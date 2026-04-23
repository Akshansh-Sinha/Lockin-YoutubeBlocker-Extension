import type { StorageSchema, Whitelist, WhitelistItem } from './types';
import { getDefaults } from './migrations';

type LegacyWhitelistItem = string | WhitelistItem;
type LegacyWhitelist = {
  videos?: LegacyWhitelistItem[];
  playlists?: LegacyWhitelistItem[];
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

  return {
    videos: videos.map(normalizeWhitelistItem).filter((item): item is WhitelistItem => item !== null),
    playlists: playlists.map(normalizeWhitelistItem).filter((item): item is WhitelistItem => item !== null),
  };
}

export async function getStorage(): Promise<StorageSchema> {
  const data = await chrome.storage.local.get(null);
  const stored = data as Partial<Omit<StorageSchema, 'whitelist'>> & { whitelist?: LegacyWhitelist };

  const schema = getDefaults();
  return {
    schemaVersion: stored.schemaVersion ?? schema.schemaVersion,
    whitelist: normalizeWhitelist(stored.whitelist, schema.whitelist),
    settings: stored.settings ?? schema.settings,
    security: stored.security ?? schema.security,
    override: stored.override ?? schema.override,
    rateLimit: stored.rateLimit ?? schema.rateLimit,
  };
}

export async function setStorage(schema: StorageSchema): Promise<void> {
  await chrome.storage.local.set(schema);
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
  await setStorage(schema);
}

export async function setRateLimit(attemptCount: number, lockedUntil: number | null): Promise<void> {
  const schema = await getStorage();
  schema.rateLimit.attemptCount = attemptCount;
  schema.rateLimit.lockedUntil = lockedUntil;
  await setStorage(schema);
}

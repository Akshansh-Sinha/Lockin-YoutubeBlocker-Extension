import type { StorageSchema } from './types';
import { getDefaults } from './migrations';

export async function getStorage(): Promise<StorageSchema> {
  const data = await chrome.storage.local.get(null);
  const stored = data as Partial<StorageSchema>;

  const schema = getDefaults();
  return {
    schemaVersion: stored.schemaVersion ?? schema.schemaVersion,
    whitelist: stored.whitelist ?? schema.whitelist,
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
  const exists = schema.whitelist.videos.some(item => item.id === videoId);
  if (!exists) {
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
  const exists = schema.whitelist.playlists.some(item => item.id === playlistId);
  if (!exists) {
    schema.whitelist.playlists.push({ id: playlistId, name });
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

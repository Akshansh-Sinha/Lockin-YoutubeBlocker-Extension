import type { StorageSchema } from './types';

export function getDefaults(): StorageSchema {
  return {
    schemaVersion: 1,
    whitelist: {
      videos: [],
      playlists: [],
    },
    settings: {
      stripRelated: true,
      stripComments: true,
      stripShorts: true,
      allowKeywords: ['tutorial', 'lecture', 'explained', 'course', 'problem solving', 'walkthrough'],
      blockKeywords: ['vlog', 'prank', 'reaction', 'meme', 'shorts', 'compilation'],
    },
    security: {
      passwordHash: null,
      salt: null,
    },
    override: {
      activeUntil: null,
    },
    rateLimit: {
      attemptCount: 0,
      lockedUntil: null,
    },
  };
}

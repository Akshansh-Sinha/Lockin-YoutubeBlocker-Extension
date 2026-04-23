import type { StorageSchema } from '@/storage/types';

export interface Verdict {
  action: 'allow' | 'block' | 'override_required';
  reason: string;
}

export interface Context {
  url: URL;
  now: number;
  override: StorageSchema['override'];
  settings: StorageSchema['settings'];
  whitelist: StorageSchema['whitelist'];
}

export type Rule = (ctx: Context) => Verdict | null;
